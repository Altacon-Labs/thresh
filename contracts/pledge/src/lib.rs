#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, Address,
    BytesN, Env,
};

#[contractclient(name = "RegistryClient")]
pub trait Registry {
    fn eligible(env: Env, lot: BytesN<32>, owner: Address, version: u32) -> bool;
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PledgeError {
    InvalidTerms = 1,
    LotAlreadyPledged = 2,
    PledgeIdUsed = 3,
    IneligibleInspection = 4,
    MissingPledge = 5,
    NotActive = 6,
    InvalidPayment = 7,
    PaymentAlreadyRecorded = 8,
    BalanceOutstanding = 9,
}

#[contracttype]
#[derive(Clone)]
struct Config {
    registry: Address,
    lender: Address,
    warehouse: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Terms {
    pub lot: BytesN<32>,
    pub borrower: Address,
    pub inspection_version: u32,
    pub principal_kobo: u128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PledgeRecord {
    pub terms: Terms,
    pub outstanding_kobo: u128,
    pub released: bool,
}

#[contracttype]
enum Key {
    Config,
    Pledge(BytesN<32>),
    ActiveLot(BytesN<32>),
    Payment(BytesN<32>),
}

#[contractevent]
pub struct PledgeOpened {
    #[topic]
    pub pledge_id: BytesN<32>,
    #[topic]
    pub lot: BytesN<32>,
    pub terms: Terms,
}

#[contractevent]
pub struct PaymentRecorded {
    #[topic]
    pub pledge_id: BytesN<32>,
    pub receipt_digest: BytesN<32>,
    pub amount_kobo: u128,
    pub outstanding_kobo: u128,
}

#[contractevent]
pub struct PledgeReleased {
    #[topic]
    pub pledge_id: BytesN<32>,
    #[topic]
    pub lot: BytesN<32>,
}

#[contract]
pub struct CollateralPledge;

#[contractimpl]
impl CollateralPledge {
    pub fn __constructor(env: Env, registry: Address, lender: Address, warehouse: Address) {
        assert!(lender != warehouse, "lender and warehouse must be distinct");
        env.storage().instance().set(
            &Key::Config,
            &Config {
                registry,
                lender,
                warehouse,
            },
        );
    }

    pub fn open(
        env: Env,
        pledge_id: BytesN<32>,
        terms: Terms,
    ) -> Result<PledgeRecord, PledgeError> {
        let config = config(&env);
        if terms.principal_kobo == 0
            || terms.borrower == config.lender
            || terms.borrower == config.warehouse
            || pledge_id == BytesN::from_array(&env, &[0; 32])
        {
            return Err(PledgeError::InvalidTerms);
        }

        config.lender.require_auth();
        config.warehouse.require_auth();
        terms.borrower.require_auth();

        let storage = env.storage().persistent();
        let lot_key = Key::ActiveLot(terms.lot.clone());
        let pledge_key = Key::Pledge(pledge_id.clone());
        if storage.has(&pledge_key) {
            return Err(PledgeError::PledgeIdUsed);
        }
        if storage.has(&lot_key) {
            return Err(PledgeError::LotAlreadyPledged);
        }
        if !RegistryClient::new(&env, &config.registry).eligible(
            &terms.lot,
            &terms.borrower,
            &terms.inspection_version,
        ) {
            return Err(PledgeError::IneligibleInspection);
        }

        let record = PledgeRecord {
            outstanding_kobo: terms.principal_kobo,
            terms,
            released: false,
        };
        storage.set(&pledge_key, &record);
        storage.set(&lot_key, &pledge_id);
        PledgeOpened {
            pledge_id,
            lot: record.terms.lot.clone(),
            terms: record.terms.clone(),
        }
        .publish(&env);
        Ok(record)
    }

    pub fn record_payment(
        env: Env,
        pledge_id: BytesN<32>,
        receipt_digest: BytesN<32>,
        amount_kobo: u128,
    ) -> Result<PledgeRecord, PledgeError> {
        config(&env).lender.require_auth();
        let mut record = active_record(&env, &pledge_id)?;
        let storage = env.storage().persistent();
        let payment_key = Key::Payment(receipt_digest.clone());
        if storage.has(&payment_key) {
            return Err(PledgeError::PaymentAlreadyRecorded);
        }
        if amount_kobo == 0
            || amount_kobo > record.outstanding_kobo
            || receipt_digest == BytesN::from_array(&env, &[0; 32])
        {
            return Err(PledgeError::InvalidPayment);
        }

        record.outstanding_kobo -= amount_kobo;
        storage.set(&Key::Pledge(pledge_id.clone()), &record);
        storage.set(&payment_key, &pledge_id);
        PaymentRecorded {
            pledge_id,
            receipt_digest,
            amount_kobo,
            outstanding_kobo: record.outstanding_kobo,
        }
        .publish(&env);
        Ok(record)
    }

    pub fn release(env: Env, pledge_id: BytesN<32>) -> Result<PledgeRecord, PledgeError> {
        let config = config(&env);
        config.lender.require_auth();
        config.warehouse.require_auth();
        let mut record = active_record(&env, &pledge_id)?;
        if record.outstanding_kobo != 0 {
            return Err(PledgeError::BalanceOutstanding);
        }

        record.released = true;
        let storage = env.storage().persistent();
        storage.set(&Key::Pledge(pledge_id.clone()), &record);
        storage.remove(&Key::ActiveLot(record.terms.lot.clone()));
        PledgeReleased {
            pledge_id,
            lot: record.terms.lot.clone(),
        }
        .publish(&env);
        Ok(record)
    }

    pub fn pledge(env: Env, pledge_id: BytesN<32>) -> Option<PledgeRecord> {
        env.storage().persistent().get(&Key::Pledge(pledge_id))
    }

    pub fn active_pledge(env: Env, lot: BytesN<32>) -> Option<BytesN<32>> {
        env.storage().persistent().get(&Key::ActiveLot(lot))
    }
}

fn config(env: &Env) -> Config {
    env.storage().instance().get(&Key::Config).unwrap()
}

fn active_record(env: &Env, pledge_id: &BytesN<32>) -> Result<PledgeRecord, PledgeError> {
    let record = CollateralPledge::pledge(env.clone(), pledge_id.clone())
        .ok_or(PledgeError::MissingPledge)?;
    if record.released
        || CollateralPledge::active_pledge(env.clone(), record.terms.lot.clone()).as_ref()
            != Some(pledge_id)
    {
        return Err(PledgeError::NotActive);
    }
    Ok(record)
}

#[cfg(test)]
mod test;

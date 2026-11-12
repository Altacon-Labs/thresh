#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
};

const MAX_VALIDITY_SECONDS: u64 = 30 * 24 * 60 * 60;

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RegistryError {
    InvalidInspection = 1,
    OwnerMismatch = 2,
    MissingInspection = 3,
    VersionMismatch = 4,
    AlreadyRevoked = 5,
    InvalidDigest = 6,
    VersionOverflow = 7,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Inspection {
    pub owner: Address,
    pub digest: BytesN<32>,
    pub inspected_at: u64,
    pub expires_at: u64,
    pub version: u32,
    pub revoked: bool,
}

#[contracttype]
enum Key {
    Verifier,
    Lot(BytesN<32>),
}

#[contractevent]
pub struct InspectionRecorded {
    #[topic]
    pub lot: BytesN<32>,
    pub inspection: Inspection,
}

#[contractevent]
pub struct InspectionRevoked {
    #[topic]
    pub lot: BytesN<32>,
    pub version: u32,
    pub reason_digest: BytesN<32>,
}

#[contract]
pub struct CollateralRegistry;

#[contractimpl]
impl CollateralRegistry {
    pub fn __constructor(env: Env, verifier: Address) {
        env.storage().instance().set(&Key::Verifier, &verifier);
    }

    pub fn attest(
        env: Env,
        lot: BytesN<32>,
        owner: Address,
        digest: BytesN<32>,
        inspected_at: u64,
        expires_at: u64,
    ) -> Result<Inspection, RegistryError> {
        verifier(&env).require_auth();
        if lot == BytesN::from_array(&env, &[0; 32]) || digest == BytesN::from_array(&env, &[0; 32])
        {
            return Err(RegistryError::InvalidDigest);
        }

        let now = env.ledger().timestamp();
        if inspected_at > now
            || expires_at <= now
            || expires_at - inspected_at > MAX_VALIDITY_SECONDS
        {
            return Err(RegistryError::InvalidInspection);
        }

        let key = Key::Lot(lot.clone());
        let version = match env.storage().persistent().get::<_, Inspection>(&key) {
            Some(previous) => {
                if previous.owner != owner {
                    return Err(RegistryError::OwnerMismatch);
                }
                if inspected_at <= previous.inspected_at {
                    return Err(RegistryError::InvalidInspection);
                }
                previous
                    .version
                    .checked_add(1)
                    .ok_or(RegistryError::VersionOverflow)?
            }
            None => 1,
        };

        let inspection = Inspection {
            owner,
            digest,
            inspected_at,
            expires_at,
            version,
            revoked: false,
        };
        env.storage().persistent().set(&key, &inspection);
        InspectionRecorded {
            lot,
            inspection: inspection.clone(),
        }
        .publish(&env);
        Ok(inspection)
    }

    pub fn revoke(
        env: Env,
        lot: BytesN<32>,
        expected_version: u32,
        reason_digest: BytesN<32>,
    ) -> Result<(), RegistryError> {
        verifier(&env).require_auth();
        let key = Key::Lot(lot.clone());
        let mut inspection: Inspection = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::MissingInspection)?;
        if inspection.version != expected_version {
            return Err(RegistryError::VersionMismatch);
        }
        if inspection.revoked {
            return Err(RegistryError::AlreadyRevoked);
        }
        if reason_digest == BytesN::from_array(&env, &[0; 32]) {
            return Err(RegistryError::InvalidDigest);
        }
        inspection.revoked = true;
        env.storage().persistent().set(&key, &inspection);
        InspectionRevoked {
            lot,
            version: expected_version,
            reason_digest,
        }
        .publish(&env);
        Ok(())
    }

    pub fn inspection(env: Env, lot: BytesN<32>) -> Option<Inspection> {
        env.storage().persistent().get(&Key::Lot(lot))
    }

    pub fn eligible(env: Env, lot: BytesN<32>, owner: Address, version: u32) -> bool {
        Self::inspection(env.clone(), lot).is_some_and(|inspection| {
            inspection.owner == owner
                && inspection.version == version
                && !inspection.revoked
                && env.ledger().timestamp() < inspection.expires_at
        })
    }
}

fn verifier(env: &Env) -> Address {
    env.storage().instance().get(&Key::Verifier).unwrap()
}

#[cfg(test)]
mod test;

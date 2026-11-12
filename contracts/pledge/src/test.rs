use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    IntoVal,
};
use thresh_registry::{CollateralRegistry, CollateralRegistryClient};

struct Fixture {
    env: Env,
    registry: Address,
    pledge: Address,
    lender: Address,
    warehouse: Address,
    borrower: Address,
}

impl Fixture {
    fn new() -> Self {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        let verifier = Address::generate(&env);
        let lender = Address::generate(&env);
        let warehouse = Address::generate(&env);
        let borrower = Address::generate(&env);
        let registry = env.register(CollateralRegistry, (&verifier,));
        let pledge = env.register(CollateralPledge, (&registry, &lender, &warehouse));
        Self {
            env,
            registry,
            pledge,
            lender,
            warehouse,
            borrower,
        }
    }

    fn client(&self) -> CollateralPledgeClient<'_> {
        CollateralPledgeClient::new(&self.env, &self.pledge)
    }

    fn registry(&self) -> CollateralRegistryClient<'_> {
        CollateralRegistryClient::new(&self.env, &self.registry)
    }

    fn hash(&self, value: u8) -> BytesN<32> {
        BytesN::from_array(&self.env, &[value; 32])
    }

    fn terms(&self, lot: u8) -> Terms {
        Terms {
            lot: self.hash(lot),
            borrower: self.borrower.clone(),
            inspection_version: 1,
            principal_kobo: 50_000,
        }
    }

    fn attest(&self, terms: &Terms) {
        self.registry().mock_all_auths().attest(
            &terms.lot,
            &terms.borrower,
            &self.hash(100),
            &990,
            &1_200,
        );
    }
}

#[test]
fn tracks_repayment_and_releases_only_after_settlement() {
    let fixture = Fixture::new();
    let client = fixture.client();
    let terms = fixture.terms(1);
    let id = fixture.hash(2);
    fixture.attest(&terms);
    let record = client.mock_all_auths().open(&id, &terms);
    assert_eq!(record.outstanding_kobo, 50_000);
    let auths = fixture.env.auths();
    assert_eq!(auths.len(), 3);
    for actor in [&fixture.lender, &fixture.warehouse, &fixture.borrower] {
        assert!(auths.iter().any(|(address, _)| address == actor));
    }
    assert_eq!(client.active_pledge(&terms.lot), Some(id.clone()));
    assert_eq!(
        client.mock_all_auths().try_open(&fixture.hash(3), &terms),
        Err(Ok(PledgeError::LotAlreadyPledged)),
    );
    assert_eq!(
        client.mock_all_auths().try_release(&id),
        Err(Ok(PledgeError::BalanceOutstanding))
    );
    assert_eq!(
        client
            .mock_all_auths()
            .try_record_payment(&id, &fixture.hash(4), &50_001),
        Err(Ok(PledgeError::InvalidPayment)),
    );
    assert_eq!(
        client
            .mock_all_auths()
            .record_payment(&id, &fixture.hash(4), &15_000)
            .outstanding_kobo,
        35_000
    );
    assert_eq!(
        client
            .mock_all_auths()
            .try_record_payment(&id, &fixture.hash(4), &15_000),
        Err(Ok(PledgeError::PaymentAlreadyRecorded)),
    );
    client
        .mock_all_auths()
        .record_payment(&id, &fixture.hash(5), &35_000);
    assert_eq!(client.active_pledge(&terms.lot), Some(id.clone()));

    let release = MockAuthInvoke {
        contract: &fixture.pledge,
        fn_name: "release",
        args: (&id,).into_val(&fixture.env),
        sub_invokes: &[],
    };
    assert!(client
        .mock_auths(&[MockAuth {
            address: &fixture.lender,
            invoke: &release
        }])
        .try_release(&id)
        .is_err());
    assert!(!client.pledge(&id).unwrap().released);
    assert!(client.mock_all_auths().release(&id).released);
    assert_eq!(client.active_pledge(&terms.lot), None);
    assert_eq!(
        client.mock_all_auths().try_open(&id, &terms),
        Err(Ok(PledgeError::PledgeIdUsed))
    );
    client.mock_all_auths().open(&fixture.hash(3), &terms);
    assert_eq!(
        client
            .mock_all_auths()
            .try_record_payment(&fixture.hash(3), &fixture.hash(4), &1),
        Err(Ok(PledgeError::PaymentAlreadyRecorded)),
    );
}

#[test]
fn rejects_unapproved_actors_and_ineligible_inspections() {
    let fixture = Fixture::new();
    let client = fixture.client();
    let terms = fixture.terms(1);
    let id = fixture.hash(2);
    assert_eq!(
        client.mock_all_auths().try_open(&id, &terms),
        Err(Ok(PledgeError::IneligibleInspection))
    );
    fixture.attest(&terms);

    let open = MockAuthInvoke {
        contract: &fixture.pledge,
        fn_name: "open",
        args: (&id, &terms).into_val(&fixture.env),
        sub_invokes: &[],
    };
    assert!(client
        .mock_auths(&[
            MockAuth {
                address: &fixture.lender,
                invoke: &open
            },
            MockAuth {
                address: &fixture.warehouse,
                invoke: &open
            },
        ])
        .try_open(&id, &terms)
        .is_err());
    assert_eq!(client.active_pledge(&terms.lot), None);

    let mut wrong_version = terms.clone();
    wrong_version.inspection_version = 2;
    assert_eq!(
        client.mock_all_auths().try_open(&id, &wrong_version),
        Err(Ok(PledgeError::IneligibleInspection))
    );
    fixture.env.ledger().set_timestamp(1_200);
    assert_eq!(
        client.mock_all_auths().try_open(&id, &terms),
        Err(Ok(PledgeError::IneligibleInspection))
    );
}

#[test]
fn revoked_inspection_blocks_new_pledges_but_preserves_existing_lock() {
    let fixture = Fixture::new();
    let client = fixture.client();
    let terms = fixture.terms(1);
    let id = fixture.hash(2);
    fixture.attest(&terms);
    client.mock_all_auths().open(&id, &terms);
    fixture
        .registry()
        .mock_all_auths()
        .revoke(&terms.lot, &1, &fixture.hash(7));
    assert_eq!(client.active_pledge(&terms.lot), Some(id.clone()));
    assert!(client
        .mock_auths(&[])
        .try_record_payment(&id, &fixture.hash(8), &50_000)
        .is_err());
    client
        .mock_all_auths()
        .record_payment(&id, &fixture.hash(8), &50_000);
    client.mock_all_auths().release(&id);
    assert_eq!(
        client.mock_all_auths().try_open(&fixture.hash(3), &terms),
        Err(Ok(PledgeError::IneligibleInspection)),
    );
}

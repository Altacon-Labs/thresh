use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};

#[test]
fn only_the_verifier_can_attest() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let verifier = Address::generate(&env);
    let owner = Address::generate(&env);
    let id = env.register(CollateralRegistry, (&verifier,));
    let client = CollateralRegistryClient::new(&env, &id);
    let lot = BytesN::from_array(&env, &[1; 32]);
    let digest = BytesN::from_array(&env, &[2; 32]);

    assert!(client
        .try_attest(&lot, &owner, &digest, &990, &1_200)
        .is_err());
    assert_eq!(client.inspection(&lot), None);
    env.mock_all_auths();
    assert_eq!(
        client.attest(&lot, &owner, &digest, &990, &1_200).version,
        1
    );
    assert_eq!(env.auths().len(), 1);
    assert_eq!(env.auths()[0].0, verifier);
}

#[test]
fn validates_inspection_time_version_owner_and_revocation() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let verifier = Address::generate(&env);
    let owner = Address::generate(&env);
    let other = Address::generate(&env);
    let id = env.register(CollateralRegistry, (&verifier,));
    let client = CollateralRegistryClient::new(&env, &id);
    let lot = BytesN::from_array(&env, &[1; 32]);
    let digest = BytesN::from_array(&env, &[2; 32]);
    let reason = BytesN::from_array(&env, &[3; 32]);

    for (inspection, expiry) in [
        (1_001, 1_200),
        (900, 1_000),
        (990, 991 + MAX_VALIDITY_SECONDS),
    ] {
        assert_eq!(
            client.try_attest(&lot, &owner, &digest, &inspection, &expiry),
            Err(Ok(RegistryError::InvalidInspection)),
        );
    }
    client.attest(&lot, &owner, &digest, &990, &1_200);
    assert!(client.eligible(&lot, &owner, &1));
    assert!(!client.eligible(&lot, &other, &1));
    assert_eq!(
        client.try_attest(&lot, &other, &digest, &991, &1_200),
        Err(Ok(RegistryError::OwnerMismatch)),
    );
    assert_eq!(
        client.try_revoke(&lot, &2, &reason),
        Err(Ok(RegistryError::VersionMismatch)),
    );
    client.revoke(&lot, &1, &reason);
    assert!(!client.eligible(&lot, &owner, &1));
    assert_eq!(
        client.try_revoke(&lot, &1, &reason),
        Err(Ok(RegistryError::AlreadyRevoked)),
    );
    assert_eq!(
        client.attest(&lot, &owner, &digest, &991, &1_250).version,
        2
    );
    assert!(!client.eligible(&lot, &owner, &1));
    assert!(client.eligible(&lot, &owner, &2));
    env.ledger().set_timestamp(1_250);
    assert!(!client.eligible(&lot, &owner, &2));
}

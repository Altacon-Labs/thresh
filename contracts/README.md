# Thresh Soroban contracts

The contracts are standalone. The web app uses Manage Data for live Testnet proofs and simulates proofs in demo mode. The GitHub Actions workflow runs the contract tests and Wasm build on Linux.

| Crate | Responsibilities |
| --- | --- |
| `thresh-registry` | The configured verifier records a versioned inspection digest and expiry for a lot and its owner. A verifier can revoke the current version or replace it with a newer inspection. |
| `thresh-pledge` | The borrower, lender, and warehouse authorize a pledge against an eligible inspection. The contract allows one active pledge per lot, records lender-confirmed repayments, and requires the lender and warehouse to authorize release after the balance reaches zero. |

The pledge contract calls the registry during opening and checks the exact inspection version. An inspection that expires or is revoked after opening leaves the active pledge in place. Repayment reduces the outstanding principal in NGN kobo. A receipt digest can be recorded once across the pledge contract.

These contracts track acknowledgments and balances. Bank transfers, lender underwriting, defaults, and physical warehouse release require offchain workflows. Deploy with distinct role holders. Each deployment currently fixes the verifier, lender, and warehouse addresses at construction.

## Test and build

From this directory, with a Rust toolchain and native linker installed:

```sh
cargo test --workspace --locked
cargo fmt --all --check
rustup target add wasm32v1-none
cargo build --workspace --locked --release --target wasm32v1-none
```

The tests exercise both contracts together, including missing authorizations, wrong or expired inspections, revocation, duplicate pledges and repayments, partial repayment, and release. Wasm artifacts are written to `target/wasm32v1-none/release/`. On Windows, install Visual Studio Build Tools with the C++ toolchain and Windows SDK, or run the tests in a Linux environment with Rust and a linker.

## Wiring later

1. Deploy the registry with the verifier address. Deploy the pledge contract with the registry contract address and the lender and warehouse addresses.
2. Derive a single stable lot ID from the canonical warehouse and receipt identifiers. Persist that mapping and use one authoritative pledge deployment per pilot. A different ID or deployment can represent the same physical stock, so the offchain warehouse and lender controls must also check for competing claims.
3. Hash private inspection and payment evidence offchain. Send digests and the required account addresses to the contracts. Store the original evidence privately. Use the registry's returned inspection version when opening a pledge.
4. Wait for transaction confirmation and persist the transaction hash and ledger with the application record. Use the public contract getters to reconcile confirmed state. Keep the database pledge reservation and physical release process synchronized with the confirmed pledge.
5. Monitor and maintain Soroban storage TTLs for both contract instances and persistent records. Restore archived state when required before retrying a transaction.

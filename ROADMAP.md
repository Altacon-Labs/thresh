# Thresh contribution backlog for Stellar Wave

This audit covers the local React/Vite, NestJS/MongoDB and Soroban source, browser tests and CI. The W IDs are planning references to replace with GitHub issue numbers.

| Area | Current implementation | Gap |
| --- | --- | --- |
| Explore | Sample collateral and stock prices, charts and watchlists | Stock browser coverage and shared state across routes |
| Wallet and API | SEP-53 login, role scoping, inventory and Horizon proofs | Transaction signing, trustlines, quotes and trade reconciliation |
| Evidence | Human review with external evidence references | Private uploads and AI-assisted review |
| Soroban | Standalone registry and NGN pledge acknowledgments | App integration, storage restoration and token settlement |
| CI | Node, MongoDB, browser and Rust checks | npm lockfiles and reproducible installs |

## Milestones

1. **Repository and Explore readiness.** Repeatable CI, tested stock discovery and Testnet wallet transaction signing.
2. **Stellar Testnet stock trading.** Authorize a demo wallet, settle a buy and sell, and verify balances and receipts. Demo tokens convey no shareholding rights.
3. **Collateral verification and lending.** Accept private evidence, review it, fund an approved Testnet loan and release its pledge after confirmed repayment.
4. **Live issuer integration.** Show one approved offering with documented rights, eligible investor onboarding, execution, reconciliation and reporting.

## Publishing the first Wave

Start with **W01–W07, W18 and W23**. These can start independently. Check the target GitHub repository for overlapping issues before posting. The local snapshot has no root LICENSE and the backend package is marked UNLICENSED. Confirm the intended license and any inherited terms with the repository owner.

In Drips, onboard the repository and select GitHub issues through **Maintainers → Issues → Add to Wave**. Confirm complexity there. Adding the program label directly defaults to Trivial. Ask contributors to link their PR to the assigned issue. See the [Drips maintainer guide](https://docs.drips.network/wave/maintainers/participating-in-a-wave/) and [FAQ](https://docs.drips.network/wave/maintainers/faq/).

Before assigning the live integration issues, maintainers must choose jurisdictions and the issuer-sponsored or custodian-held structure, confirm partner responsibilities for onboarding, custody, execution and liquidity, and obtain sandbox access and approved disclosures. Launch requires staging reconciliation and partner sign-off. See [Investor.gov on tokenized securities](https://www.investor.gov/introduction-investing/investing-basics/investment-products/tokenized-securities) and [Stellar on tokenized assets](https://stellar.org/learn/tokenized-investment-assets).



## Milestone 1 · Repository and Explore readiness

### W01 · Add tokenized-stock browsing regression tests

**Suggested Wave complexity** Trivial

The browser suite covers collateral Explore but has no stock-listing coverage. Start in [`frontend/e2e/inventory.spec.ts`](frontend/e2e/inventory.spec.ts).

**Acceptance criteria**

- Cover ticker search, opening a stock chart, and watchlist add/remove across reload. Assert the preview label and USD prices.

### W02 · Document the stock preview and Testnet demo entry points

**Suggested Wave complexity** Trivial

Public stock listings are fictional and separate from private collateral. Start in [`README.md`](README.md).

**Acceptance criteria**

- Add a short walkthrough with expected screens, test commands, and a clear statement of what can be tried without a wallet. Verify links.

### W03 · Make frontend and backend CI installs reproducible

**Suggested Wave complexity** Medium

CI installs both npm projects with npm install and the snapshot has no npm lockfiles. Start in [`.github/workflows/checks.yml`](.github/workflows/checks.yml).

**Acceptance criteria**

- Add lockfiles, switch CI to npm ci, and show a clean checkout passes the existing build and checks.

### W04 · Unify Explore watchlist persistence across asset and stock routes

**Suggested Wave complexity** Medium

The shared hook reads browser storage separately in each mounted view. Start in [`frontend/src/pages/inventory/useExploreWatchlist.ts`](frontend/src/pages/inventory/useExploreWatchlist.ts).

**Acceptance criteria**

- Centralize state within the public app. Test add/remove across stock list, stock detail and collateral routes, reload persistence, and graceful handling of invalid storage.

### W05 · Add clear routing for unknown public assets and preserve stock search

**Suggested Wave complexity** Medium

Unknown detail IDs can fall through to Explore. Stock scope is passed in query parameters. Start in [`frontend/src/pages/inventory/Inventory.tsx`](frontend/src/pages/inventory/Inventory.tsx).

**Acceptance criteria**

- Show a recoverable missing-listing state and cover stock search from listing/detail routes, clearing search and back navigation.

### W06 · Show wallet capability and network before signing a transaction

**Suggested Wave complexity** Medium

Existing wallet flow signs SEP-53 messages for authentication. Start in [`frontend/src/pages/inventory/stellarWallet.ts`](frontend/src/pages/inventory/stellarWallet.ts).

**Acceptance criteria**

- Add a reusable Testnet transaction-signing adapter and display the active network. Cover unsupported extension, account change, wrong network, and user rejection with a mocked adapter.


## Milestone 2 · Stellar Testnet stock trading

### W07 · Define verified listing and asset identity records

**Suggested Wave complexity** Medium

The current catalog has sample symbols and price history only. Start in [`frontend/src/pages/inventory/tokenizedStocks.ts`](frontend/src/pages/inventory/tokenizedStocks.ts).

**Acceptance criteria**

- Define a catalog record with network, asset code, issuer, quote asset identity, status, rights summary and source. Reject duplicate network/code/issuer keys and keep samples explicitly separate.

### W08 · Provision repeatable Stellar Testnet issuance and liquidity fixtures

**Suggested Wave complexity** High

**Depends on** W07

The current setup provisions inspection proof accounts, with no trading fixture. Start in [`contracts/README.md`](contracts/README.md).

**Acceptance criteria**

- Provide a repeatable setup for a demo equity token and test settlement asset with separate issuer, distributor and buyer roles. Document funding, issued balances and seeded two-sided liquidity. Keep signer secrets out of output and source control.

### W09 · Add wallet trustline and eligibility states

**Suggested Wave complexity** Medium

**Depends on** W06, W07

The stock preview currently has no wallet readiness checks. Start in [`frontend/src/pages/inventory/StockMarket.tsx`](frontend/src/pages/inventory/StockMarket.tsx).

**Acceptance criteria**

- Read balances and trustline status for exact issuer identities. Display missing, pending approval and authorized states. Let users sign the trustline creation and refresh after confirmation.

### W10 · Expose executable Testnet buy and sell quotes

**Suggested Wave complexity** Medium

**Depends on** W07, W08

No stock quote endpoint exists in the API. Start in [`backend/src/modules/inventory/inventory.module.ts`](backend/src/modules/inventory/inventory.module.ts).

**Acceptance criteria**

- Add a trading module with expiring quotes from test liquidity. Return side, quantity, maximum payment or minimum proceeds, fees and asset identities. Cover stale quotes, empty liquidity and exact decimal amounts.

### W11 · Wire Testnet buy orders through wallet confirmation

**Suggested Wave complexity** High

**Depends on** W06, W09, W10, W13

Stock detail shows a price chart without an order flow. Start in [`frontend/src/pages/inventory/StockMarket.tsx`](frontend/src/pages/inventory/StockMarket.tsx).

**Acceptance criteria**

- Build a buy confirmation screen, sign on Testnet, submit and confirm settlement. Verify exact issuer, signed intent, minimum received, and both resulting balances. Test rejection and insufficient funds.

### W12 · Wire Testnet sell orders and display execution outcomes

**Suggested Wave complexity** High

**Depends on** W11

There is no sell flow or order status. Start in [`frontend/src/pages/inventory/StockMarket.tsx`](frontend/src/pages/inventory/StockMarket.tsx).

**Acceptance criteria**

- Sell held units for the configured test settlement asset. Cover no liquidity, expiry, partial fills if the selected execution method permits them, and confirmed balance changes.

### W13 · Persist trade intent and reconcile confirmed Stellar transactions

**Suggested Wave complexity** High

**Depends on** W07

Wallet sessions exist, but there is no trade order store or reconciliation. Start in [`backend/src/modules/inventory/inventory-wallet.service.ts`](backend/src/modules/inventory/inventory-wallet.service.ts).

**Acceptance criteria**

- Add wallet-scoped orders in a trading module. Validate transaction intent and ledger result before marking a trade filled. Handle duplicate submissions, timeouts, retries and failed transactions without duplicate fills.

### W14 · Build Testnet portfolio and order history

**Suggested Wave complexity** Medium

**Depends on** W09, W13

Current private workspaces focus on collateral roles. Start in [`frontend/src/app/WorkspaceLayout.tsx`](frontend/src/app/WorkspaceLayout.tsx).

**Acceptance criteria**

- Show wallet-scoped stock balances, order statuses and transaction links. Distinguish confirmed holdings from pending orders and cover an empty portfolio.

### W15 · Add the stock trading end-to-end walkthrough and test

**Suggested Wave complexity** Medium

**Depends on** W08, W11, W12, W14

Current browser tests exercise inventory and inspection proofs. Start in [`frontend/e2e/inventory.spec.ts`](frontend/e2e/inventory.spec.ts).

**Acceptance criteria**

- Add deterministic browser coverage for quote, signature, buy, balance update and sell. Document a separate real Testnet smoke run with fixture accounts and expected ledger evidence.


## Milestone 3 · Collateral verification and loan lifecycle

### W16 · Store private evidence attachments with workspace access controls

**Suggested Wave complexity** High

Evidence IDs reference files held outside Thresh. Start in [`backend/src/modules/inventory/inventory.schema.ts`](backend/src/modules/inventory/inventory.schema.ts).

**Acceptance criteria**

- Upload and retrieve scoped evidence through an abstraction with a local test adapter. Enforce file type and size limits, private access and deletion policy. Test cross-workspace denial.

### W17 · Show extracted serial numbers and evidence mismatches in the verifier queue

**Suggested Wave complexity** Medium

**Depends on** W16

The verifier enters decisions manually and cannot inspect automated findings in the app. Start in [`frontend/src/pages/inventory/Inventory.tsx`](frontend/src/pages/inventory/Inventory.tsx).

**Acceptance criteria**

- Define an extraction adapter with synthetic fixtures. Show extracted facts and missing or conflicting evidence to the verifier. Record provider/model version when present and leave the decision with the verifier.

### W18 · Add financing applications linked to verified collateral

**Suggested Wave complexity** Medium

A valuation exists independently of any loan request. Start in [`backend/src/modules/inventory/inventory.module.ts`](backend/src/modules/inventory/inventory.module.ts).

**Acceptance criteria**

- Add operator submission and lender review states with amount, asset reference and workspace scope. Test duplicate and invalid transitions and review after verification expiry.

### W19 · Publish Soroban registry attestations from the inspection workflow

**Suggested Wave complexity** High

**Depends on** W06

The app anchors Manage Data proofs and the registry runs standalone. Start in [`contracts/registry/src/lib.rs`](contracts/registry/src/lib.rs).

**Acceptance criteria**

- Add Testnet deployment instructions and a wallet-driven attestation flow. Reconcile lot ID, inspection version, expiry and transaction hash. Preserve existing inspection proof history.

### W20 · Track Soroban pledge reservation and release in the workspace

**Suggested Wave complexity** High

**Depends on** W18, W19

Pledge open and release exist in Soroban but are not called by the app. Start in [`contracts/pledge/src/lib.rs`](contracts/pledge/src/lib.rs).

**Acceptance criteria**

- Wire a Testnet pledge around a currently eligible registry entry. Verify required signers and prevent duplicate active reservations. Surface release only when contract conditions are met.

### W21 · Fund an approved Testnet loan with a Stellar stablecoin

**Suggested Wave complexity** High

**Depends on** W08, W18, W20

The API records valuations and proofs, and the pledge tracks NGN kobo. Start in [`backend/src/modules/inventory/inventory.service.ts`](backend/src/modules/inventory/inventory.service.ts).

**Acceptance criteria**

- Record funding terms and token minor units separately from NGN valuations. Confirm lender-to-borrower transfer against agreed terms and reconcile failed or duplicate submissions.

### W22 · Reconcile partial and full Testnet loan repayments

**Suggested Wave complexity** High

**Depends on** W21

The contract accepts lender-confirmed payment acknowledgments in kobo. Start in [`contracts/pledge/src/lib.rs`](contracts/pledge/src/lib.rs).

**Acceptance criteria**

- Match confirmed repayment transfers to the loan in token units. Test partial payment, duplicate hash, wrong asset and settlement. Specify the conversion or contract migration for existing kobo balances before changing their semantics.

### W23 · Document contract storage lifetime and test restoration on Testnet

**Suggested Wave complexity** Medium

The guide mentions TTL upkeep but there is no repository automation for it. Start in [`contracts/README.md`](contracts/README.md).

**Acceptance criteria**

- Provide a reproducible monitor or operator script and a Testnet restore walkthrough. Cover active registry and pledge records and document alerting and verification steps.


## Milestone 4 · Live issuer and securities integration

### W24 · Integrate an approved issuer catalog and rights disclosures

**Suggested Wave complexity** High

**Depends on** W07; partner sandbox and approved terms

Public listings have no real issuer or underlying security. Start in [`frontend/src/pages/inventory/tokenizedStocks.ts`](frontend/src/pages/inventory/tokenizedStocks.ts).

**Acceptance criteria**

- Integrate a partner sandbox with verified code/issuer/network mappings, offering status, jurisdiction eligibility and dated rights disclosures. Verify suspension and unknown issuer behavior.

### W25 · Integrate partner onboarding and reconcile live settlement in staging

**Suggested Wave complexity** High

**Depends on** W15, W24; approved onboarding and execution arrangements

Stellar wallet authentication does not establish investor eligibility. Start in [`backend/src/modules/inventory/inventory-wallet.service.ts`](backend/src/modules/inventory/inventory-wallet.service.ts).

**Acceptance criteria**

- Use the partner sandbox to verify eligibility and wallet binding, route orders through approved execution, and reconcile settlement and reporting. Exercise denied access, corrections and corporate-action display with sandbox events.

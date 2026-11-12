# Thresh on Stellar

Thresh helps lenders review physical assets as potential collateral. An asset operator records what the asset is, where it is held, and what evidence supports the record. An independent verifier checks it, and a lender records a sourced price and optional approved valuation. A verifier can also anchor an inspection digest on Stellar Testnet.

Assets can stay at the **owner’s site**, with a **third-party custodian**, or in a **warehouse**. For example, register a generator at a workshop using its serial number and invoice reference.

| Category | Registration details | Price basis |
| --- | --- | --- |
| Maize | Weight and grade | NGN per kilogram |
| Packaged goods | Item count, batch ID, and condition | NGN per item |
| Spare parts | Item count, SKU or part number, and condition | NGN per item |
| Equipment | One item per serial number, with condition | NGN per item |

Existing maize receipts, valuations, and Stellar proof references work with the same database.

## Run the app

Use Node.js 22.18 or later. From `frontend`, run `npm install` and `npm run dev`. Open the URL printed by Vite to browse **Explore** without an account. Public quotes and charts are illustrative and load without an API connection. Explore defaults to USD using a fixed sample rate of ₦1,500 per dollar. Open **Settings** from Explore or the workspace to choose USD or NGN for Explore and save a Stellar stablecoin preference (USDC or EURC) in your browser. Private valuations are recorded in NGN. Stablecoin transfers are not wired.

Explore highlights recent price movers, your browser’s watchlist, and a Market Status card with the latest estimated inventory value and a chart of sample quote observations by date. Use **Sign up** next to search to request workspace access. Select a star next to an asset to add it to your watchlist. Search from the public navigation and use category tabs to filter the reference quotes. Open an asset to see its price history and estimate its value by quantity. On desktop, asset information sits left of the chart and valuation tools sit on the right. The panels stack on phones. Signed-in workspaces keep navigation on the left and contextual information on the right.

For private workspace access, follow the [pilot setup guide](INVENTORY-PILOT.md) to start MongoDB and the API. Select **Sign in**, choose your role, and either connect your linked Stellar wallet or enter your workspace key. **Request access** explains how the administrator can link your public address or issue a key.

| Sign in as | Starting page | First action |
| --- | --- | --- |
| Asset operator | Asset registry | Register an asset with its location and supporting evidence. |
| Verifier | Inspection queue | Open a pending or expired record and enter an inspection decision. Use **All assets** to find earlier inspections. |
| Lender | Collateral review | Open a verified asset to review evidence and record a valuation. Use **Markets** to explore the workspace’s recorded quotes. |

The API checks the role tied to the wallet or key. A wallet session ends when it expires, you sign out, or Thresh detects that the active wallet changed or disconnected. Sign-out and browser refresh return you to Explore. Credentials are held in memory for the current tab. An empty private workspace stays empty.

Wallet sign-in uses a [Stellar SEP-53 message signature](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md) through the Varial browser extension (formerly Freighter). It signs a message offchain and uses no XLM. For verifiers, the linked address is also the address Thresh expects on Stellar Testnet inspection proofs.

On **Markets**, filter by category or search for an asset, reference, or market. Select a quote to see its history, then choose **Open asset record**. Quotes are entered manually. Change compares the latest two dates for the same lot, market, and source.

## Optional sample data

To try the real sign-in and workflows with 24 synthetic records, set the database name to `thresh_demo` in `backend/.env`, generate the pilot keys, and run `npm run pilot:seed` from `backend`. The seed command only writes to that named database. Re-running it adds missing sample records without replacing existing ones.

## Anchor an inspection

1. Fund a dedicated Testnet account via [Stellar Lab](https://lab.stellar.org/). Add its public G-address as `stellarAccount` on the verifier entry in `INVENTORY_ACTORS_JSON`. Keep the signing key in your wallet.
2. Register a sample asset with the asset operator key. With the verifier access key, record a current inspection and choose **Get Stellar transaction details**.
3. In [Stellar Lab](https://lab.stellar.org/transaction/build), select Testnet. Use the displayed account as the transaction source and add exactly one **Manage Data** operation. Leave the operation source blank. Copy the displayed name and 64-character value as text. Sign with the configured account and submit to Testnet.
4. Paste the resulting transaction hash into Thresh and choose **Verify and save proof**. The API checks the successful transaction, expected source account, and exact operation value via Testnet Horizon before saving it. The lender can open the transaction from the review history.

Each new anchor replaces the same account data entry. Previous proofs reference their own transactions. Testnet resets can remove ledger history. Use synthetic records. Only a salted digest goes onchain. The proof records the inspection attestation and does not create a pledge or move funds.

The app opens directly to the inventory workspace. The API reads Stellar Testnet transactions through Horizon, and verifiers sign and submit proofs through Stellar Lab.

## Value a verified lot

Sign in as a lender and open a lot with a current verification. Enter the market, source, observation date, and price for the recorded grade or condition. Thresh multiplies the price by the registered kilograms or item count. An optional lender-approved value is tracked separately from the estimate.

Record a second observation date for the same source and market to see a price chart. Workspace participants can review the valuation history. Prices are entered manually, and a recorded valuation does not approve a loan.

## Tests

| Area | Command | Coverage |
| --- | --- | --- |
| Frontend logic | `npm test` from `frontend` | Role checks, queue filtering, seed data, expiry, pricing math, and API responses |
| Browser | `npx playwright install chromium`, then `npm run test:e2e` from `frontend` | Role-based sign-in, queue filters, Markets navigation, responsive layout, and proof UI with simulated API responses |
| Backend | `npm test` from `backend` | Build, published Stellar signature vectors, wallet challenge and session rules, access keys, valuation rules, and mocked Horizon proof verification |
| Full stack | Start an isolated MongoDB instance, build the backend, then set `THRESH_LIVE_E2E=1` and run `npm run test:e2e` from `frontend` | Browser through NestJS and MongoDB, including registration, review, valuation, and workspace isolation |
| Contracts | `cargo test --workspace --locked` from `contracts` | Registry and pledge rules, authorization, repayment, and release |

The full-stack tests default to `mongodb://127.0.0.1:27017/thresh_browser_test`. Set `THRESH_BROWSER_DB` to use another isolated test database. The test runner starts the API on port 3102 and Vite on 4173. The GitHub Actions workflow runs builds and tests on push and pull request.

## Soroban contracts

The [Soroban workspace](contracts/README.md) contains the standalone inspection registry and pledge tracker for later integration. The running app uses the Stellar Lab and Horizon proof flow described above.

## Push to your repository

Extract the archive and open the `thresh-stellar` folder in a terminal. Create an empty GitHub repository, then run the commands below with its Git URL.

```sh
git init -b main
git add .
git commit -m "Add Thresh Stellar Testnet edition"
git remote add origin <your-github-repository-url>
git push -u origin main
```

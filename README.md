# Thresh on Stellar

Thresh helps lenders review warehouse inventory and equipment as potential collateral. A warehouse registers an asset, an independent verifier checks it, and a lender records a sourced price and optional approved valuation. A verifier can also anchor an inspection digest on Stellar Testnet.

| Category | Registration details | Price basis |
| --- | --- | --- |
| Maize | Weight and grade | NGN per kilogram |
| Packaged goods | Item count, batch ID, and condition | NGN per item |
| Spare parts | Item count, SKU or part number, and condition | NGN per item |
| Equipment | One item per serial number, with condition | NGN per item |

Existing maize receipts, valuations, and Stellar proof references work with the same database.

## Try the demo

Use Node.js 22.18 or later. From `frontend`, run `npm install` and `npm run dev`. Open the URL printed by Vite. The demo starts with **24 sample records across all four categories** and a preselected lot with price history.

1. Switch to **Warehouse**, choose an asset category, and register a lot with a new receipt number.
2. Switch to **Verifier** and approve the lot with a recent inspection time. **Simulate Stellar proof** adds a sample proof to the history.
3. Switch to **Lender** and enter prices for the same market and source on two different dates to see the chart.

Demo changes stay in the current tab until reload or **Reset demo**. The demo requires no API, database, or wallet.

## Connect live records

Follow the [pilot setup guide](INVENTORY-PILOT.md) to start MongoDB and the API and generate access keys. In the app, choose **Connect live workspace** and enter a key. A successful sign-in replaces the demo records with the API response, including an empty list for a new workspace. Failed live requests show an error. Sign-out returns to the demo when enabled. Set `VITE_ENABLE_DEMO=false` for a sign-in-only deployment.

## Anchor an inspection

1. Fund a dedicated Testnet account via [Stellar Lab](https://lab.stellar.org/). Add its public G-address as `stellarAccount` on the verifier entry in `INVENTORY_ACTORS_JSON`. Keep the signing key in your wallet.
2. Register a sample lot with the warehouse access key. With the verifier access key, record a current inspection and choose **Get Stellar transaction details**.
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
| Frontend logic | `npm test` from `frontend` | Seed data, role transitions, expiry, pricing math, and live response handling |
| Browser | `npx playwright install chromium`, then `npm run test:e2e` from `frontend` | Demo forms, chart, live sign-in and empty states, and the proof UI with simulated responses |
| Backend | `npm test` from `backend` | Build, access keys, request validation, valuation rules, and mocked Horizon proof verification |
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

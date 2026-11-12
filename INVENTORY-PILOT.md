## Inventory financing pilot

Thresh supports maize, packaged goods, spare parts, and equipment held at an owner’s site, by a third party, or in a warehouse. A workspace can have multiple asset operators. An approval is current for 30 days from inspection time. A verifier can renew an expired approval with a fresh inspection.

### Run locally

1. Start MongoDB. Copy `backend/.env.example` to `backend/.env`, set `MONGODB_URI`, and run `npm install` from `backend`.
2. From `backend`, provision separate access keys for the asset operator, verifier, and lender:

   ```shell
   npm run pilot:keys
   ```

   Pass the funded verifier's Testnet public G-address after `--` to enable live Stellar proofs. Copy the emitted `INVENTORY_ACTORS_JSON` line into `backend/.env` and share the original keys individually.
3. Run `npm run dev` from `backend`. The API defaults to port 3000 and exposes Swagger at the server root.
4. From `frontend`, run `npm install` and `npm run dev`. Open Vite's URL and select **Sign in**. Choose **Asset operator**, **Verifier**, or **Lender**, then enter the corresponding key. To change the API URL, copy `frontend/.env.example` to `frontend/.env` and edit it before starting Vite. Set `VITE_WORKSPACE_CONTACT_EMAIL` to show a contact link under **Request access**. A workspace administrator issues keys.

The actor configuration is a JSON array with `id`, `workspaceId`, and `role`, plus `tokenHash` for access-key sign-in, `walletAddress` for wallet sign-in, or both. The API uses the existing `warehouse` role value for the Asset operator role. Participants in a workspace share the workspace ID and have distinct actor IDs and credentials. Rotate a key by replacing its hash and restarting the API. Keep keys and database credentials out of source control. Use HTTPS outside localhost.

### Enable Stellar wallet sign-in

1. Set `THRESH_APP_ORIGIN` in `backend/.env` to the exact frontend origin, such as `http://localhost:5173` or your HTTPS deployment origin. Include the port if Vite uses a different one. Omit paths and trailing slashes.
2. Add each participant’s Stellar public G-address as `walletAddress` on their actor entry. Each address belongs to one actor and role per deployment. A verifier’s existing `stellarAccount` also enables wallet sign-in. If both fields are set for a verifier, use the same address for both. Restart the API after changing links.
3. Open Thresh in a browser with the [Varial extension](https://github.com/stellar/freighter-developer-docs/blob/main/extension/installation.md) enabled, select **Sign in**, choose your role, then select **Continue with Stellar wallet**. Approve the sign-in message in the linked account.

Challenges expire after five minutes and can be used once. Wallet sessions expire after eight hours. Sign-out revokes the session token through the API. Thresh checks the active wallet when the tab regains focus, while the workspace is visible, and before workspace actions. Switching or disconnecting the wallet sends you back to Explore when detected. The wallet’s signing key stays in the extension.

When a verifier publishes an inspection proof, select the same linked account in Stellar Lab and use **Stellar Testnet**. Signing into Thresh itself is an offchain action.

### Walk through a lot

Register an asset with the operator key. Enter its site or facility, a unique reference, and the matching evidence ID. Use a warehouse receipt for warehouse stock, an ownership document for assets at the owner’s site, or a custody acknowledgment for third-party holdings. Enter whole kilograms and grade for maize. For other assets, enter the name, condition, and requested identifier. Use one record and a distinct reference per equipment item. Equipment serial numbers are unique within the workspace.

Existing warehouse records continue to work without a migration. The API accepts the original `receiptNumber` and `receiptEvidenceId` field names for all references. New registration forms also send `custodyType` and `custodyLocation`. New Stellar proof digests bind those fields when supplied.

With the verifier key, record an inspection time, evidence ID, and decision. As lender, enter a dated price per kilogram for maize or per item for the other categories. A second quote from the same market and source on a different date adds a chart. Workspace participants can read the history.

To populate a development workspace with 24 sample records, point `MONGODB_URI` at the `thresh_demo` database, configure the pilot actors, and run `npm run pilot:seed` from `backend`. Sign in with the pilot role keys to walk through the sample records.

Evidence IDs refer to documents stored outside the app. Use synthetic records for walkthroughs. See the [README](README.md#anchor-an-inspection) for a Stellar Testnet proof and the [contract guide](contracts/README.md) for planned Soroban wiring.

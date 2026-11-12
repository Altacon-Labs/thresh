## Inventory financing pilot

Thresh supports maize, packaged goods, spare parts, and equipment. Each API workspace supports one warehouse actor. An approval is current for 30 days from inspection time. A verifier can renew an expired approval with a fresh inspection.

### Run locally

1. Start MongoDB. Copy `backend/.env.example` to `backend/.env`, set `MONGODB_URI`, and run `npm install` from `backend`.
2. From `backend`, provision separate access keys for the warehouse, verifier, and lender:

   ```shell
   npm run pilot:keys
   ```

   Pass the funded verifier's Testnet public G-address after `--` to enable live Stellar proofs. Copy the emitted `INVENTORY_ACTORS_JSON` line into `backend/.env` and share the original keys individually.
3. Run `npm run dev` from `backend`. The API defaults to port 3000 and exposes Swagger at the server root.
4. From `frontend`, run `npm install` and `npm run dev`. Open Vite's URL, choose **Connect live workspace**, and enter a key. To change the API URL or disable demo mode, copy `frontend/.env.example` to `frontend/.env` and edit it before starting Vite.

The actor configuration is a JSON array with `id`, `workspaceId`, `role`, and `tokenHash`. The verifier may also have a `stellarAccount`. Participants in a workspace share the workspace ID and have distinct actor IDs and key hashes. Rotate a key by replacing its hash and restarting the API. Keep keys and database credentials out of source control. Use HTTPS outside localhost.

### Walk through a lot

Register a lot with the warehouse key. Every category requires a receipt number and receipt evidence ID. Enter whole kilograms and grade for maize. For other assets, enter the name, condition, and the requested identifier. Use one record and a distinct receipt per equipment item. Equipment serial numbers are unique within the workspace.

With the verifier key, record an inspection time, evidence ID, and decision. As lender, enter a dated price per kilogram for maize or per item for the other categories. A second quote from the same market and source on a different date adds a chart. Workspace participants can read the history.

Evidence IDs refer to documents stored outside the app. Use synthetic records for walkthroughs. See the [README](README.md#anchor-an-inspection) for a Stellar Testnet proof and the [contract guide](contracts/README.md) for planned Soroban wiring.

import { createHash, randomBytes } from "node:crypto";

const stellarAccount = process.argv[2];
if (stellarAccount && !/^G[A-Z2-7]{55}$/.test(stellarAccount)) {
  console.error("Pass the verifier's Stellar Testnet public G-address, or omit it.");
  process.exit(1);
}

const actors = ["warehouse", "verifier", "lender"].map((role) => {
  const accessKey = randomBytes(32).toString("hex");
  console.log(`${role === "warehouse" ? "asset operator" : role} access key: ${accessKey}`);
  return {
    id: `pilot-${role}`,
    role,
    workspaceId: "pilot",
    tokenHash: createHash("sha256").update(accessKey).digest("hex"),
    ...(role === "verifier" && stellarAccount ? { stellarAccount } : {}),
  };
});

console.log(`\nCopy only this configuration line into backend/.env:\nINVENTORY_ACTORS_JSON='${JSON.stringify(actors)}'`);

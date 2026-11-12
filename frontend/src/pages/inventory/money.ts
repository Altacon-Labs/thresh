export function formatNaira(kobo: number) {
  const amount = BigInt(kobo);
  return `₦${(amount / 100n).toLocaleString("en-NG")}.${String(amount % 100n).padStart(2, "0")}`;
}

export function parseNaira(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error("Enter a naira amount with up to two decimal places.");
  const kobo = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  if (kobo < 1n || kobo > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Enter a valid amount greater than zero.");
  }
  return Number(kobo);
}

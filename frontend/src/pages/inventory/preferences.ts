export type QuoteCurrency = "USD" | "NGN";
export type Preferences = { currency: QuoteCurrency; stablecoin: "USDC" | "EURC" };

export const preferenceKey = "thresh.preferences";
export const sampleNairaPerDollar = 1500;
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function parsePreferences(raw: string | null): Preferences {
  try {
    const saved = raw ? JSON.parse(raw) : null;
    return {
      currency: saved?.currency === "NGN" ? "NGN" : "USD",
      stablecoin: saved?.stablecoin === "EURC" ? "EURC" : "USDC",
    };
  } catch {
    return { currency: "USD", stablecoin: "USDC" };
  }
}

export function sampleQuoteAmount(kobo: number, currency: QuoteCurrency) {
  return kobo / 100 / (currency === "USD" ? sampleNairaPerDollar : 1);
}

export function formatSampleUsd(kobo: number) {
  return usd.format(sampleQuoteAmount(kobo, "USD"));
}

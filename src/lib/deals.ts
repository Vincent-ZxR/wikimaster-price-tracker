import type { ExtractedCard } from "./types";

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/gu, " ").normalize("NFC").toLocaleLowerCase("fr-FR");
}

export function normalizeRarity(rarity: string): string {
  return rarity.trim().toUpperCase();
}

export function priceKey(name: string, rarity: string): string {
  return JSON.stringify([normalizeName(name), normalizeRarity(rarity)]);
}

function listingPrice(card: Pick<ExtractedCard, "startingPrice" | "currentPrice">): number | null {
  const price = card.currentPrice !== null ? card.currentPrice : card.startingPrice;
  return price !== null && Number.isFinite(price) && price >= 0 ? price : null;
}

export function effectiveAveragePrice(rarity: string | null, savedAverage: number | null): number | null {
  return savedAverage ?? (normalizeRarity(rarity ?? "") === "L" ? 286 : null);
}

export function expirationAt(pastedAt: number | null, duration: string | null): Date | null {
  if (pastedAt === null || !Number.isFinite(pastedAt) || !duration ||
      !/^\s*(?:\d+\s*[jdhms]\s*)+$/iu.test(duration)) return null;
  const units: Record<string, number> = { j: 86400, d: 86400, h: 3600, m: 60, s: 1 };
  let seconds = 0;
  for (const match of duration.matchAll(/(\d+)\s*([jdhms])/giu)) {
    seconds += Number(match[1]) * units[match[2].toLowerCase()];
  }
  if (!Number.isSafeInteger(seconds)) return null;
  const result = new Date(pastedAt + seconds * 1000);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function isNightExpiration(expiration: Date | null): boolean {
  return expiration !== null && expiration.getHours() >= 3 && expiration.getHours() < 7;
}

export function compareListing(
  card: Pick<ExtractedCard, "startingPrice" | "currentPrice">,
  average: number | null,
): { price: number; kind: "actuelle" | "départ"; discount: number; good: boolean } | null {
  const isCurrent = card.currentPrice !== null;
  const price = listingPrice(card);
  if (price === null ||
      average === null || !Number.isFinite(average) || average <= 0) {
    return null;
  }
  return {
    price,
    kind: isCurrent ? "actuelle" : "départ",
    discount: (1 - price / average) * 100,
    good: price * 10 <= average * 8,
  };
}

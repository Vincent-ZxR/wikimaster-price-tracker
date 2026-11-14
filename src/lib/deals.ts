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

export function compareListing(
  card: Pick<ExtractedCard, "startingPrice" | "currentPrice">,
  average: number | null,
): { price: number; kind: "actuelle" | "départ"; discount: number; good: boolean } | null {
  const isCurrent = card.currentPrice !== null;
  const price = isCurrent ? card.currentPrice : card.startingPrice;
  if (price === null || !Number.isFinite(price) || price < 0 ||
      average === null || !Number.isFinite(average) || average <= 0) {
    return null;
  }
  return {
    price,
    kind: isCurrent ? "actuelle" : "départ",
    discount: (1 - price / average) * 100,
    good: price * 10 <= average * (isCurrent ? 7 : 8),
  };
}

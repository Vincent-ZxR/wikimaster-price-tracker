import type { ExtractedCard, PriceSummary } from "./types";

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/gu, " ").normalize("NFC").toLocaleLowerCase("fr-FR");
}

export function normalizeRarity(rarity: string): string {
  const normalized = rarity.trim().toUpperCase();
  return /^L\s*(?:✦|SHINY)$/u.test(normalized) ? "L✦" : normalized;
}

export function isValidRarity(rarity: string): boolean {
  return /^(?:L✦|L|UR|SR|R|PC|C)$/u.test(normalizeRarity(rarity));
}

export function matchesCardSearch(name: string, search: string): boolean {
  const normalize = (value: string) => normalizeName(value).normalize("NFD").replace(/\p{M}/gu, "");
  const query = normalize(search);
  return query.length > 0 && normalize(name).includes(query);
}

export function isEnded(duration: string | null): boolean {
  return duration?.trim().toLocaleLowerCase("fr-FR") === "terminée";
}

export function priceKey(name: string, rarity: string): string {
  return JSON.stringify([normalizeName(name), normalizeRarity(rarity)]);
}

export function priceObservations(
  cards: Pick<ExtractedCard, "cardName" | "cardType" | "currentPrice" | "confidence" | "seller" | "remainingTime">[],
  pastedAt: number | null,
) {
  return cards.flatMap((card, position) => {
    const nameKey = normalizeName(card.cardName);
    const rarity = normalizeRarity(card.cardType ?? "");
    const price = card.currentPrice;
    const seller = normalizeName(card.seller ?? "");
    const expiration = isEnded(card.remainingTime)
      ? pastedAt === null ? null : new Date(pastedAt)
      : expirationAt(pastedAt, card.remainingTime);
    const validExpiration = expiration && Number.isFinite(expiration.getTime()) ? expiration.toISOString() : null;
    return card.confidence === "high" && nameKey.length > 0 && nameKey.length <= 200 &&
      isValidRarity(rarity) && price !== null && Number.isSafeInteger(price) &&
      price >= 1 && price <= 1_000_000_000
      ? [{
        position, name_key: nameKey, card_type: rarity, current_price: price,
        seller_key: seller.length > 0 && seller.length <= 200 ? seller : null,
        expires_at: validExpiration,
      }]
      : [];
  });
}

function listingPrice(card: Pick<ExtractedCard, "startingPrice" | "currentPrice">): number | null {
  const price = card.currentPrice !== null ? card.currentPrice : card.startingPrice;
  return price !== null && Number.isFinite(price) && price >= 0 ? price : null;
}

export function effectiveAveragePrice(rarity: string | null, savedAverage: number | null): number | null {
  return savedAverage ?? (["L", "L✦"].includes(normalizeRarity(rarity ?? "")) ? 286 : null);
}

export function estimatePrice(rarity: string | null, personal: number | null, summary: PriceSummary | undefined) {
  const market = summary && summary.sample_count >= 5 ? summary.upper_quartile : null;
  const value = personal !== null
    ? market === null ? personal : Math.round(personal * 0.75 + market * 0.25)
    : market === null ? effectiveAveragePrice(rarity, null) : Math.round(market);
  const source = personal !== null
    ? market === null ? "personnel" : "personnel + observations"
    : market === null ? value === null ? null : "défaut légendaire" : "observations";
  const quality = market === null ? null
    : summary && summary.sample_count >= 20 && summary.upper_quartile <= summary.lower_quartile * 2
      ? "modérée" : "faible";
  return { value, market, source, quality };
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
  card: Pick<ExtractedCard, "startingPrice" | "currentPrice"> & Partial<Pick<ExtractedCard, "remainingTime">>,
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
    good: !isEnded(card.remainingTime ?? null) && price * 10 <= average * 8,
  };
}

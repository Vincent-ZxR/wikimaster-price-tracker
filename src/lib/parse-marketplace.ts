import type { ExtractedCard } from "./types";

type ParsedCard = Omit<ExtractedCard, "id">;

type Header = {
  start: number;
  type: string;
  name: string;
  subtitle: string | null;
};

const LISTING = /Mise\s+(de\s+départ|actuelle)\s*([\d\u00a0\u202f ]+?)\s*Durée\s*((?:\d+\s*[jdhms]\s*)+)\s*Vendu\s+par\s*/giu;
const STATS_AT_END = /(\d{1,3}(?:[\u00a0\u202f ]\d{3})+|\d+)(\d{1,3}(?:[\u00a0\u202f ]\d{3})+|\d+)\s*$/u;
const DESCRIPTION = /coureur\s|coureuse\s|cycliste\s|course\s|\d+(?:e|ème)\s+édition\s/iu;
const BADGE = /(?:UR|SR|PC|L|R|C)(?=\p{Lu}|\p{N})/gu;
const PRICE_LABEL = /Mise\s+(?:de\s+départ|actuelle)/giu;

function findHeader(segment: string): Header | null {
  const stats = STATS_AT_END.exec(segment);
  if (!stats || stats.index === undefined) return null;

  const beforeStats = segment.slice(0, stats.index).replace(/Possédée\s*$/iu, "");
  const description = DESCRIPTION.exec(beforeStats);
  if (!description || description.index === undefined) return null;

  let descriptionStart = description.index;
  const combinedYear = /(\d{4})(?=\d+(?:e|ème)\s+édition\s)/iu.exec(beforeStats);
  if (combinedYear?.index !== undefined && combinedYear.index < descriptionStart + 4) {
    descriptionStart = combinedYear.index + 4;
  }

  let lastBadge: RegExpExecArray | null = null;
  BADGE.lastIndex = 0;
  for (const match of beforeStats.matchAll(BADGE)) {
    if (match.index < descriptionStart) lastBadge = match;
  }
  if (!lastBadge || lastBadge.index === undefined) return null;

  const name = beforeStats.slice(lastBadge.index + lastBadge[0].length, descriptionStart).trim();
  if (!name) return null;
  return {
    start: lastBadge.index,
    type: lastBadge[0],
    name,
    subtitle: beforeStats.slice(descriptionStart).trim() || null,
  };
}

export function parseMarketplaceText(text: string): {
  cards: ParsedCard[];
  warnings: string[];
} {
  const matches = Array.from(text.matchAll(LISTING));
  if (matches.length > 100) {
    return {
      cards: [],
      warnings: ["Plus de 100 annonces détectées. Copiez-les en plusieurs fois."],
    };
  }

  const cards: ParsedCard[] = [];
  const warnings: string[] = [];
  let previousSellerStart = 0;
  const priceLabelCount = Array.from(text.matchAll(PRICE_LABEL)).length;
  if (priceLabelCount > matches.length) {
    warnings.push(
      `${priceLabelCount - matches.length} annonce(s) incomplète(s) n'ont pas pu être analysées.`,
    );
  }

  for (const match of matches) {
    const segment = text.slice(previousSellerStart, match.index);
    const header = findHeader(segment);

    if (cards.length > 0) {
      cards[cards.length - 1].seller = header && !segment.match(PRICE_LABEL)
        ? segment.slice(0, header.start).trim() || null
        : null;
    }

    if (!header) {
      warnings.push(
        `Annonce ${cards.length + 1} : nom ou type non reconnu${cards.length ? " ; vérifiez aussi le vendeur précédent" : ""}.`,
      );
    }

    const price = Number(match[2].replace(/[\s\u00a0\u202f]/gu, ""));
    if (!Number.isSafeInteger(price)) {
      warnings.push(`Annonce ${cards.length + 1} : prix invalide, à saisir manuellement.`);
    }
    const validPrice = Number.isSafeInteger(price) ? price : null;
    const current = match[1].toLowerCase() === "actuelle";
    cards.push({
      cardName: header?.name ?? "",
      cardType: header?.type ?? null,
      subtitle: header?.subtitle ?? null,
      currentPrice: current ? validPrice : null,
      startingPrice: current ? null : validPrice,
      remainingTime: match[3].trim().replace(/\s+/gu, " "),
      seller: null,
      confidence: "low",
    });
    previousSellerStart = match.index + match[0].length;
  }

  if (cards.length) {
    const tail = text.slice(previousSellerStart);
    cards[cards.length - 1].seller = tail.match(PRICE_LABEL)
      ? null
      : tail.trim() || null;
  } else {
    warnings.push(
      "Aucune annonce reconnue. Copiez le texte du marché en français, avec les mises, durées et vendeurs.",
    );
  }

  return { cards, warnings };
}

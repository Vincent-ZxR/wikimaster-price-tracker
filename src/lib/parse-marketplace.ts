import type { ExtractedCard } from "./types";

type ParsedCard = Omit<ExtractedCard, "id">;
type Header = { type: string; name: string; uncertain: boolean };

const LISTING = /Mise\s+(de\s+départ|actuelle)\s*([\d\u00a0\u202f ]+?)\s*Durée\s*((?:\d+\s*[jdhms]\s*)+|Terminée(?!\p{L}))/giu;
const PRICE_LABEL = /Mise\s+(?:de\s+départ|actuelle)/giu;
const RARITY = /^(?:UR|SR|PC|L|R|C)$/u;

function findLineHeader(segment: string): Header | null {
  const lines = segment.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);

  for (let index = lines.length - 2; index >= 0; index--) {
    if (!RARITY.test(lines[index])) continue;
    const second = lines[index + 1].replace(/\s+/gu, " ").normalize("NFC");
    if (!second || RARITY.test(second) || /^\d[\d\s]*$/u.test(second)) continue;
    return {
      name: second,
      type: lines[index],
      uncertain: false,
    };
  }
  return null;
}

function findConcatenatedHeader(segment: string): Header | null {
  const stats = /(\d{1,3}(?:[\u00a0\u202f ]\d{3})+|\d+)(\d{1,3}(?:[\u00a0\u202f ]\d{3})+|\d+)\s*$/u.exec(segment);
  if (!stats) return null;

  const beforeStats = segment.slice(0, stats.index).replace(/Possédée\s*$/iu, "");
  const description = /coureur\s|coureuse\s|cycliste\s|course\s|\d+(?:e|ème)\s+édition\s/iu.exec(beforeStats);
  if (!description) return null;

  let descriptionStart = description.index;
  const combinedYear = /(\d{4})(?=\d+(?:e|ème)\s+édition\s)/iu.exec(beforeStats);
  if (combinedYear && combinedYear.index < descriptionStart + 4) {
    descriptionStart = combinedYear.index + 4;
  }

  let badge: RegExpExecArray | null = null;
  for (const match of beforeStats.matchAll(/(?:UR|SR|PC|L|R|C)(?=\p{Lu}|\p{N})/gu)) {
    if (match.index < descriptionStart) badge = match;
  }
  if (!badge) return null;
  const name = beforeStats.slice(badge.index + badge[0].length, descriptionStart).trim();
  return name ? { name, type: badge[0], uncertain: true } : null;
}

export function parseMarketplaceText(text: string): {
  cards: ParsedCard[];
  warnings: string[];
} {
  const matches = Array.from(text.matchAll(LISTING));
  const priceLabelCount = Array.from(text.matchAll(PRICE_LABEL)).length;
  if (priceLabelCount > 1000) {
    return {
      cards: [],
      warnings: ["Plus de 1 000 annonces détectées. Copiez-les en plusieurs fois."],
    };
  }

  const cards: ParsedCard[] = [];
  const warnings: string[] = [];
  let previousEnd = 0;
  if (priceLabelCount > matches.length) {
    warnings.push(
      `${priceLabelCount - matches.length} annonce(s) incomplète(s) n'ont pas pu être analysées.`,
    );
  }

  for (const match of matches) {
    const segment = text.slice(previousEnd, match.index);
    const header =
      findLineHeader(segment) ??
      (/^(?:UR|SR|PC|L|R|C)\s*$/mu.test(segment)
        ? null
        : findConcatenatedHeader(segment));

    if (!header) {
      warnings.push(`Annonce ${cards.length + 1} : nom ou rareté non reconnu.`);
    } else if (header.uncertain) {
      warnings.push(`Annonce ${cards.length + 1} : vérifiez le nom et la rareté.`);
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
      bidKind: current ? "currentPrice" : "startingPrice",
      currentPrice: current ? validPrice : null,
      startingPrice: current ? null : validPrice,
      remainingTime: match[3].trim().replace(/\s+/gu, " "),
      confidence: header && !header.uncertain ? "high" : "low",
    });
    previousEnd = match.index + match[0].length;
  }

  if (!cards.length) {
    warnings.push(
      "Aucune annonce reconnue. Copiez le texte du marché en français, avec les mises et les durées.",
    );
  }

  return { cards, warnings };
}

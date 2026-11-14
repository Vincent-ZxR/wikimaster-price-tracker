import assert from "node:assert/strict";
import test from "node:test";
import { parseMarketplaceText } from "../src/lib/parse-marketplace.ts";

test("reads repeated names and rarity from multiline listings independently of description", () => {
  const text = [
    "Marché", "L", "UR", "SR", "Réinitialiser",
    "Remco Evenepoel", "L", "Remco Evenepoel", "sportif belge",
    "10 000", "8 632", "Mise de départ", "4 500", "Durée", "2h 15m", "Vendu par vendeur",
    "Pauline Ferrand-Prévot", "UR", "Pauline Ferrand-Prévot",
    "Possédée", "9 000", "9 171", "Mise actuelle", "150", "Durée", "6m 34s",
  ].join("\n");
  const { cards, warnings } = parseMarketplaceText(text);
  assert.deepEqual(warnings, []);
  assert.deepEqual(cards, [
    {
      cardName: "Remco Evenepoel",
      cardType: "L",
      currentPrice: null,
      startingPrice: 4500,
      remainingTime: "2h 15m",
      confidence: "high",
    },
    {
      cardName: "Pauline Ferrand-Prévot",
      cardType: "UR",
      currentPrice: 150,
      startingPrice: null,
      remainingTime: "6m 34s",
      confidence: "high",
    },
  ]);
});

test("recognizes an event name with a year, without using the description or stats", () => {
  const text = [
    "Tour de France 2026", "UR", "Tour de France 2026",
    "113e édition de la course cycliste française", "9 000", "5 759",
    "Mise de départ", "900", "Durée", "30m 14s", "Vendu par vendeur",
  ].join("\n");
  const { cards, warnings } = parseMarketplaceText(text);
  assert.equal(cards[0].cardName, "Tour de France 2026");
  assert.equal(cards[0].cardType, "UR");
  assert.equal(cards[0].startingPrice, 900);
  assert.deepEqual(warnings, []);
});

test("warns when names disagree and handles the WikiMasters image placeholder", () => {
  const text = [
    "Vendu par vendeur", "WikiMasters", "UR", "Tour de France 2027",
    "description", "7 183", "2 823", "Mise de départ", "20", "Durée", "1h 02m",
    "Nom original", "SR", "Nom différent",
    "Mise actuelle", "30", "Durée", "2m 10s",
  ].join("\n");
  const { cards, warnings } = parseMarketplaceText(text);
  assert.equal(cards[0].cardName, "Tour de France 2027");
  assert.equal(cards[1].cardName, "Nom original");
  assert.equal(cards[0].confidence, "low");
  assert.equal(cards[1].confidence, "low");
  assert.equal(warnings.length, 2);
});

test("keeps a card editable and warns when a multiline header is missing", () => {
  const { cards, warnings } = parseMarketplaceText(
    "Nom sans rareté\nMise actuelle\n50\nDurée\n1h 10m",
  );
  assert.equal(cards.length, 1);
  assert.equal(cards[0].cardName, "");
  assert.equal(cards[0].currentPrice, 50);
  assert.match(warnings.join(" "), /non reconnu/);
});

test("still supports the previously supplied concatenated format", () => {
  const text =
    "\n\nMarchéURJacques Anquetilcoureur cycliste françaisPossédée9 0009 334Mise de départ10Durée5h 55mVendu par Moutig" +
    "UREddy Merckxcoureur cycliste belge9 0009 602Mise actuelle200Durée11h 55mVendu par chab";
  const { cards, warnings } = parseMarketplaceText(text);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].cardName, "Jacques Anquetil");
  assert.equal(cards[0].startingPrice, 10);
  assert.equal(cards[1].cardName, "Eddy Merckx");
  assert.equal(cards[1].currentPrice, 200);
  assert.equal(warnings.length, 2);
});

test("reports incomplete listings and rejects batches over the database limit", () => {
  const listing =
    "Jacques Anquetil\nUR\nJacques Anquetil\nMise de départ\n10\nDurée\n5h 55m\n";
  const incomplete = parseMarketplaceText(listing + "Mise actuelle\n20\nDurée inconnue");
  assert.equal(incomplete.cards.length, 1);
  assert.match(incomplete.warnings.join(" "), /incomplète/);
  const tooMany = parseMarketplaceText(listing.repeat(101));
  assert.equal(tooMany.cards.length, 0);
  assert.match(tooMany.warnings[0], /100/);
});

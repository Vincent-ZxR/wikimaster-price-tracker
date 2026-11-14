import assert from "node:assert/strict";
import test from "node:test";
import { parseMarketplaceText } from "../src/lib/parse-marketplace.ts";

test("extracts concatenated French listings and separates bid types", () => {
  const text =
    "MarchéURJacques Anquetilcoureur cycliste françaisPossédée9 0009 334Mise de départ10Durée5h 55mVendu par Moutig" +
    "UREddy Merckxcoureur cycliste belge9 0009 602Mise actuelle200Durée11h 55mVendu par chab";
  const result = parseMarketplaceText(text);
  assert.equal(result.cards.length, 2);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.cards[0], {
    cardName: "Jacques Anquetil",
    cardType: "UR",
    subtitle: "coureur cycliste français",
    currentPrice: null,
    startingPrice: 10,
    remainingTime: "5h 55m",
    seller: "Moutig",
    confidence: "low",
  });
  assert.equal(result.cards[1].cardName, "Eddy Merckx");
  assert.equal(result.cards[1].currentPrice, 200);
  assert.equal(result.cards[1].startingPrice, null);
  assert.equal(result.cards[1].seller, "chab");
});

test("preserves event years, numbered descriptions, and names with spaces", () => {
  const text =
    "URTour de France 2026113e édition de la course cycliste françaisePossédée9 0005 759Mise de départ900Durée30m 14sVendu par The fablab manager";
  const { cards } = parseMarketplaceText(text);
  assert.equal(cards[0].cardName, "Tour de France 2026");
  assert.equal(cards[0].subtitle, "113e édition de la course cycliste française");
  assert.equal(cards[0].seller, "The fablab manager");
});

test("flags unsupported descriptions and does not invent the preceding seller", () => {
  const text =
    "URJacques Anquetilcoureur cycliste français9 0009 334Mise de départ10Durée5h 55mVendu par vendeur" +
    "URAutre cartepersonnalité française9 0009 000Mise actuelle20Durée1h 02mVendu par autre";
  const result = parseMarketplaceText(text);
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[0].seller, null);
  assert.equal(result.cards[1].cardName, "");
  assert.ok(result.warnings.length > 0);
});

test("reports incomplete listings rather than silently including them in a seller", () => {
  const text =
    "URJacques Anquetilcoureur cycliste français9 0009 334Mise de départ10Durée5h 55mVendu par vendeur" +
    "URAutre cartecycliste français9 0009 000Mise actuelle20Durée inconnue";
  const result = parseMarketplaceText(text);
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].seller, null);
  assert.match(result.warnings.join(" "), /incomplète/);
});

test("rejects batches over the database limit", () => {
  const listing =
    "URJacques Anquetilcoureur cycliste français9 0009 334Mise de départ10Durée5h 55mVendu par vendeur";
  const result = parseMarketplaceText(listing.repeat(101));
  assert.equal(result.cards.length, 0);
  assert.match(result.warnings[0], /100/);
});

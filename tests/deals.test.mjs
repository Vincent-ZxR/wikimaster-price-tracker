import assert from "node:assert/strict";
import test from "node:test";
import { compareListing, effectiveAveragePrice, estimatePrice, expirationAt, isNightExpiration, priceKey, priceObservations } from "../src/lib/deals.ts";

test("starting bids are good deals at or below 20% under the average", () => {
  assert.equal(compareListing({ startingPrice: 800, currentPrice: null }, 1000).good, true);
  assert.equal(compareListing({ startingPrice: 801, currentPrice: null }, 1000).good, false);
  assert.equal(compareListing({ startingPrice: 799, currentPrice: null }, 1000).good, true);
});

test("current bids use the same 20% threshold as starting bids", () => {
  assert.equal(compareListing({ startingPrice: null, currentPrice: 800 }, 1000).good, true);
  assert.equal(compareListing({ startingPrice: null, currentPrice: 801 }, 1000).good, false);
  assert.equal(compareListing({ startingPrice: null, currentPrice: 799 }, 1000).good, true);
});

test("missing or invalid references never result in a deal", () => {
  assert.equal(compareListing({ startingPrice: 10, currentPrice: null }, null), null);
  assert.equal(compareListing({ startingPrice: 10, currentPrice: null }, 0), null);
  assert.equal(compareListing({ startingPrice: null, currentPrice: null }, 100), null);
  assert.equal(compareListing({ startingPrice: 0, currentPrice: null }, 100).good, true);
  assert.equal(compareListing({ startingPrice: 1, currentPrice: 0 }, 100).good, true);
});

test("the same reference applies to multiple listings but not another rarity", () => {
  const prices = new Map([[priceKey("Carte", "UR"), 1000]]);
  const reference = prices.get(priceKey(" CARTE ", "ur")) ?? null;
  assert.equal(compareListing({ startingPrice: 800, currentPrice: null }, reference).good, true);
  assert.equal(compareListing({ startingPrice: null, currentPrice: 801 }, reference).good, false);
  assert.equal(prices.get(priceKey("Carte", "SR")), undefined);
});

test("reference keys ignore case and extra whitespace but distinguish rarity", () => {
  assert.equal(priceKey("  PAUL   SEIXAS ", "ur"), priceKey("Paul Seixas", "UR"));
  assert.notEqual(priceKey("Paul Seixas", "UR"), priceKey("Paul Seixas", "L"));
  assert.equal(priceKey("Pogac\u030car", "L"), priceKey("Pogačar", "l"));
});

test("legendary default is 286, unless a personal average exists", () => {
  assert.equal(effectiveAveragePrice(" l ", null), 286);
  assert.equal(effectiveAveragePrice("UR", null), null);
  assert.equal(effectiveAveragePrice(null, null), null);
  assert.equal(effectiveAveragePrice("L", 500), 500);
  assert.equal(effectiveAveragePrice("L", 0), 0);
  assert.equal(compareListing({ startingPrice: 228, currentPrice: null }, effectiveAveragePrice("L", null)).good, true);
  assert.equal(compareListing({ startingPrice: 229, currentPrice: null }, effectiveAveragePrice("L", null)).good, false);
  assert.equal(compareListing({ startingPrice: null, currentPrice: 228 }, effectiveAveragePrice("L", null)).good, true);
  assert.equal(compareListing({ startingPrice: null, currentPrice: 229 }, effectiveAveragePrice("L", null)).good, false);
  assert.equal(compareListing({ startingPrice: 233, currentPrice: null }, effectiveAveragePrice("L", null)).good, false);
  assert.equal(compareListing({ startingPrice: 233, currentPrice: null }, effectiveAveragePrice("L", 500)).good, true);
});

test("market estimates need five observations and replace only the legendary default", () => {
  const summary = { sample_count: 4, lower_quartile: 40, upper_quartile: 120 };
  assert.equal(estimatePrice("UR", null, { ...summary, sample_count: 1 }).value, null);
  assert.equal(estimatePrice("UR", null, summary).value, null);
  assert.equal(estimatePrice("L", null, summary).value, 286);
  assert.equal(estimatePrice("L", null, { ...summary, sample_count: 5 }).value, 120);
  assert.equal(estimatePrice("UR", null, { ...summary, sample_count: 5 }).quality, "faible");
});

test("a personal price retains a 75 percent weight when market data is available", () => {
  const summary = { sample_count: 20, lower_quartile: 80, upper_quartile: 160 };
  assert.equal(estimatePrice("UR", 200, undefined).value, 200);
  assert.deepEqual(estimatePrice("UR", 200, summary), {
    value: 190, source: "personnel + observations", quality: "modérée",
  });
  assert.equal(estimatePrice("UR", 200, { ...summary, lower_quartile: 79 }).quality, "faible");
});

test("only valid and confidently identified current bids become shared observations", () => {
  const card = { cardName: "  CARTE ", cardType: "ur", currentPrice: 100, confidence: "high" };
  const cards = [
    card,
    { ...card, currentPrice: null },
    { ...card, confidence: "low" },
    { ...card, currentPrice: 0 },
    { ...card, currentPrice: 1_000_000_001 },
    { ...card, cardType: "?" },
    { ...card, cardName: " " },
    card,
  ];
  assert.deepEqual(priceObservations(cards, "capture"), [
    { capture_hash: "capture", position: 0, name_key: "carte", card_type: "UR", current_price: 100 },
    { capture_hash: "capture", position: 7, name_key: "carte", card_type: "UR", current_price: 100 },
  ]);
});

test("night expiration uses the paste time and local time across midnight and days", () => {
  const pasted = new Date(2026, 0, 1, 23, 0, 0).getTime();
  const atThree = expirationAt(pasted, "4h");
  assert.equal(atThree.getDate(), 2);
  assert.equal(isNightExpiration(atThree), true);
  assert.equal(isNightExpiration(expirationAt(pasted, "3h 59m 59s")), false);
  assert.equal(isNightExpiration(expirationAt(pasted, "7h 59m 59s")), true);
  assert.equal(isNightExpiration(expirationAt(pasted, "8h")), false);
  assert.equal(isNightExpiration(expirationAt(pasted, "1j 4h")), true);
  assert.equal(isNightExpiration(expirationAt(pasted, "1d 4h")), true);
  assert.equal(expirationAt(null, "4h"), null);
  assert.equal(expirationAt(pasted, "unknown"), null);
  assert.equal(expirationAt(pasted, "4h invalid"), null);
});

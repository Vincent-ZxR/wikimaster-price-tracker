import assert from "node:assert/strict";
import test from "node:test";
import { compareListing, effectiveAveragePrice, expirationAt, isNightExpiration, priceKey } from "../src/lib/deals.ts";

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

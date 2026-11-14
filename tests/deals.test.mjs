import assert from "node:assert/strict";
import test from "node:test";
import { compareListing, expirationAt, isLegendaryDeal, isNightExpiration, priceKey } from "../src/lib/deals.ts";

test("starting bids are good deals at or below 20% under the average", () => {
  assert.equal(compareListing({ startingPrice: 800, currentPrice: null }, 1000).good, true);
  assert.equal(compareListing({ startingPrice: 801, currentPrice: null }, 1000).good, false);
  assert.equal(compareListing({ startingPrice: 799, currentPrice: null }, 1000).good, true);
});

test("current bids are good deals at or below 30% under the average", () => {
  assert.equal(compareListing({ startingPrice: null, currentPrice: 700 }, 1000).good, true);
  assert.equal(compareListing({ startingPrice: null, currentPrice: 701 }, 1000).good, false);
  assert.equal(compareListing({ startingPrice: null, currentPrice: 699 }, 1000).good, true);
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
  assert.equal(compareListing({ startingPrice: null, currentPrice: 701 }, reference).good, false);
  assert.equal(prices.get(priceKey("Carte", "SR")), undefined);
});

test("reference keys ignore case and extra whitespace but distinguish rarity", () => {
  assert.equal(priceKey("  PAUL   SEIXAS ", "ur"), priceKey("Paul Seixas", "UR"));
  assert.notEqual(priceKey("Paul Seixas", "UR"), priceKey("Paul Seixas", "L"));
  assert.equal(priceKey("Pogac\u030car", "L"), priceKey("Pogačar", "l"));
});

test("legendary special price is strictly below 234 and uses current bid first", () => {
  assert.equal(isLegendaryDeal({ cardType: " l ", startingPrice: 233, currentPrice: null }), true);
  assert.equal(isLegendaryDeal({ cardType: "L", startingPrice: 234, currentPrice: null }), false);
  assert.equal(isLegendaryDeal({ cardType: "UR", startingPrice: 233, currentPrice: null }), false);
  assert.equal(isLegendaryDeal({ cardType: "L", startingPrice: 1, currentPrice: 234 }), false);
  assert.equal(isLegendaryDeal({ cardType: "L", startingPrice: null, currentPrice: 0 }), true);
  assert.equal(isLegendaryDeal({ cardType: "L", startingPrice: null, currentPrice: null }), false);
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

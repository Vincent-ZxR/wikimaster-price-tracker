import assert from "node:assert/strict";
import test from "node:test";
import { compareListing, priceKey } from "../src/lib/deals.ts";

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

import assert from "node:assert/strict";
import test from "node:test";
import { normalizeKeyword } from "../src/lib/keywords.ts";

test("keywords accept multiple words and retain their internal spacing", () => {
  assert.equal(normalizeKeyword("  carte rare  shiny  "), "carte rare  shiny");
  assert.equal(normalizeKeyword("  e\u0301  "), "é");
});

test("keywords reject empty, multiline, non-string and overlong values", () => {
  assert.equal(normalizeKeyword("  "), null);
  assert.equal(normalizeKeyword("un\ndeux"), null);
  assert.equal(normalizeKeyword(null), null);
  assert.equal(normalizeKeyword("x".repeat(201)), null);
  assert.equal(normalizeKeyword("😀".repeat(200)), "😀".repeat(200));
});

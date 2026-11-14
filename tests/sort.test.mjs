import assert from "node:assert/strict";
import test from "node:test";
import { compareSortValues, nextSort } from "../src/lib/sort.ts";

test("clicking a column cycles ascending, descending and default", () => {
  const ascending = nextSort(null, "price");
  assert.deepEqual(ascending, { column: "price", direction: "ascending" });
  const descending = nextSort(ascending, "price");
  assert.deepEqual(descending, { column: "price", direction: "descending" });
  assert.equal(nextSort(descending, "price"), null);
  assert.deepEqual(nextSort(descending, "name"), { column: "name", direction: "ascending" });
});

test("numeric and text values sort correctly with missing values last in both directions", () => {
  for (const direction of ["ascending", "descending"]) {
    assert.ok(compareSortValues(null, 10, direction) > 0);
    assert.ok(compareSortValues(10, null, direction) < 0);
  }
  assert.ok(compareSortValues(2, 10, "ascending") < 0);
  assert.ok(compareSortValues(2, 10, "descending") > 0);
  assert.ok(compareSortValues("Carte 2", "Carte 10", "ascending") < 0);
});

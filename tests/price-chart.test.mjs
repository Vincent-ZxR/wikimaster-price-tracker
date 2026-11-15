import assert from "node:assert/strict";
import test from "node:test";
import { priceChart } from "../src/lib/price-chart.ts";

test("the chart uses time on the horizontal axis and price on the vertical axis", () => {
  const chart = priceChart([
    { observed_at: "2026-01-01T00:00:00Z", current_price: 10 },
    { observed_at: "2026-01-02T00:00:00Z", current_price: 20 },
    { observed_at: "2026-01-04T00:00:00Z", current_price: 40 },
  ], []);
  assert.equal(chart.minimum, 10);
  assert.equal(chart.maximum, 40);
  assert.deepEqual(chart.bidPoints, [
    { x: 8, y: 188 },
    { x: 8 + 784 / 3, y: 188 - 176 / 3 },
    { x: 792, y: 12 },
  ]);
});

test("empty, single and simultaneous equal observations remain drawable", () => {
  assert.equal(priceChart([], []), null);
  const bid = { observed_at: "2026-01-01T00:00:00Z", current_price: 50 };
  assert.deepEqual(priceChart([bid], []).bidPoints, [{ x: 400, y: 100 }]);
  assert.deepEqual(priceChart([bid, bid], []).bidPoints, [{ x: 400, y: 100 }, { x: 400, y: 100 }]);
});

test("both series share the time and price axes and exclude undated averages", () => {
  const chart = priceChart(
    [{ observed_at: "2026-01-02T00:00:00Z", current_price: 50 }],
    [{ recorded_at: null, average_price: 1000 }, { recorded_at: "2026-01-01T00:00:00Z", average_price: 100 }],
  );
  assert.equal(chart.minimum, 50);
  assert.equal(chart.maximum, 100);
  assert.deepEqual(chart.bidPoints, [{ x: 792, y: 188 }]);
  assert.deepEqual(chart.averagePoints, [{ x: 8, y: 12 }]);
  assert.equal(priceChart([], [{ recorded_at: null, average_price: 100 }]), null);
});

test("dated personal averages remain visible without any current bids", () => {
  const chart = priceChart([], [{ recorded_at: "2026-01-01T00:00:00Z", average_price: 100 }]);
  assert.deepEqual(chart.averagePoints, [{ x: 400, y: 100 }]);
  assert.deepEqual(chart.bidPoints, []);
});

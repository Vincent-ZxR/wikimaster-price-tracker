import type { HistoricalAverage, HistoricalBid } from "./types";

export function priceChart(bids: HistoricalBid[], averages: HistoricalAverage[]) {
  const datedAverages = averages.filter((average): average is HistoricalAverage & { recorded_at: string } => average.recorded_at !== null);
  const values = [
    ...bids.map((bid) => ({ time: bid.observed_at, price: bid.current_price })),
    ...datedAverages.map((average) => ({ time: average.recorded_at, price: average.average_price })),
  ];
  if (values.length === 0) return null;
  let first = Infinity;
  let last = -Infinity;
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const value of values) {
    const time = Date.parse(value.time);
    first = Math.min(first, time);
    last = Math.max(last, time);
    minimum = Math.min(minimum, value.price);
    maximum = Math.max(maximum, value.price);
  }
  const point = (time: string, price: number) => ({
    x: first === last ? 400 : 8 + (Date.parse(time) - first) / (last - first) * 784,
    y: minimum === maximum ? 100 : 188 - (price - minimum) / (maximum - minimum) * 176,
  });
  return {
    first, last, minimum, maximum,
    bidPoints: bids.map((bid) => point(bid.observed_at, bid.current_price)),
    averagePoints: datedAverages.map((average) => point(average.recorded_at, average.average_price)),
  };
}

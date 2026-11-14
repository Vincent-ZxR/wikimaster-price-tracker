export type Sort<Column extends string> = {
  column: Column;
  direction: "ascending" | "descending";
};

export function nextSort<Column extends string>(
  sort: Sort<Column> | null,
  column: Column,
): Sort<Column> | null {
  if (!sort || sort.column !== column) return { column, direction: "ascending" };
  if (sort.direction === "ascending") return { column, direction: "descending" };
  return null;
}

export function compareSortValues(
  a: string | number | null,
  b: string | number | null,
  direction: Sort<string>["direction"],
): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  const result = typeof a === "number" && typeof b === "number"
    ? a - b
    : String(a).localeCompare(String(b), "fr", { sensitivity: "base", numeric: true });
  return direction === "ascending" ? result : -result;
}

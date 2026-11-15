export function normalizeKeyword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const keyword = value.trim().normalize("NFC");
  if (!keyword || Array.from(keyword).length > 200 || /[\u0000-\u001f\u007f]/u.test(keyword)) return null;
  return keyword;
}

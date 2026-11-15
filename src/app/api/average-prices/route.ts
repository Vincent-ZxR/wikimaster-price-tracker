import { authenticateRequest } from "@/lib/server-auth";
import { isValidRarity, normalizeName, normalizeRarity } from "@/lib/deals";
import type { AveragePrice } from "@/lib/types";

type PriceInput = {
  cardName: string;
  cardType: string;
  averagePrice: number;
};

function isPriceInput(value: unknown): value is PriceInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.cardName === "string" &&
    normalizeName(input.cardName).length > 0 &&
    normalizeName(input.cardName).length <= 200 &&
    input.cardName.trim().replace(/\s+/gu, " ").normalize("NFC").length <= 200 &&
    typeof input.cardType === "string" &&
    isValidRarity(input.cardType) &&
    typeof input.averagePrice === "number" &&
    Number.isSafeInteger(input.averagePrice) &&
    input.averagePrice >= 1 &&
    input.averagePrice <= 1_000_000_000
  );
}

export async function GET(request: Request) {
  const authenticated = await authenticateRequest(request);
  if (!authenticated.ok) {
    return Response.json({ error: authenticated.error }, { status: authenticated.status });
  }
  const prices: AveragePrice[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await authenticated.supabase
      .from("average_prices")
      .select("user_id, card_name, name_key, card_type, average_price")
      .eq("user_id", authenticated.user.id)
      .order("name_key")
      .order("card_type")
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error("Could not load average prices.", error.message);
      return Response.json({ error: "Impossible de charger les prix moyens." }, { status: 500 });
    }
    prices.push(...data);
    if (data.length < pageSize) break;
  }
  return Response.json({ prices });
}

export async function PUT(request: Request) {
  const authenticated = await authenticateRequest(request);
  if (!authenticated.ok) {
    return Response.json({ error: authenticated.error }, { status: authenticated.status });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Données JSON invalides." }, { status: 400 });
  }
  if (!isPriceInput(input)) {
    return Response.json({ error: "Nom, rareté ou prix moyen invalide." }, { status: 400 });
  }

  const row = {
    user_id: authenticated.user.id,
    card_name: input.cardName.trim().replace(/\s+/gu, " ").normalize("NFC"),
    name_key: normalizeName(input.cardName),
    card_type: normalizeRarity(input.cardType),
    average_price: input.averagePrice,
  };
  const { data, error } = await authenticated.supabase
    .from("average_prices")
    .upsert(row, { onConflict: "user_id,name_key,card_type" })
    .select("user_id, card_name, name_key, card_type, average_price")
    .single();
  if (error) {
    console.error("Could not save average price.", error.message);
    return Response.json({ error: "Impossible d’enregistrer le prix moyen." }, { status: 500 });
  }
  return Response.json({ price: data });
}

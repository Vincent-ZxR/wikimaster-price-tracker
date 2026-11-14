import { authenticateRequest } from "@/lib/server-auth";
import type { ExtractedCard } from "@/lib/types";

interface SaveRequest {
  capturedAt: string;
  cards: ExtractedCard[];
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullablePrice(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function isSaveRequest(value: unknown): value is SaveRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  if (
    typeof request.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(request.capturedAt)) ||
    !Array.isArray(request.cards) ||
    request.cards.length === 0 ||
    request.cards.length > 100
  ) {
    return false;
  }

  return request.cards.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const card = entry as Record<string, unknown>;
    return (
      typeof card.cardName === "string" &&
      card.cardName.trim().length > 0 &&
      card.cardName.length <= 200 &&
      isNullableString(card.cardType) &&
      isNullableString(card.subtitle) &&
      isNullablePrice(card.currentPrice) &&
      isNullablePrice(card.startingPrice) &&
      isNullableString(card.remainingTime) &&
      isNullableString(card.seller) &&
      (card.confidence === "high" ||
        card.confidence === "medium" ||
        card.confidence === "low")
    );
  });
}

export async function POST(request: Request) {
  const authenticated = await authenticateRequest(request);
  if (!authenticated.ok) {
    return Response.json(
      { error: authenticated.error },
      { status: authenticated.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isSaveRequest(body)) {
    return Response.json({ error: "The card data is invalid or incomplete." }, { status: 400 });
  }

  const rows = body.cards.map((card) => ({
    user_id: authenticated.user.id,
    card_name: card.cardName.trim(),
    card_type: card.cardType?.trim() || null,
    subtitle: card.subtitle?.trim() || null,
    current_price: card.currentPrice,
    starting_price: card.startingPrice,
    remaining_time: card.remainingTime?.trim() || null,
    seller: card.seller?.trim() || null,
    confidence: card.confidence,
    captured_at: new Date(body.capturedAt).toISOString(),
  }));

  const { error } = await authenticated.supabase.from("market_listings").insert(rows);
  if (error) {
    console.error("Could not save marketplace cards.", error.message);
    return Response.json(
      { error: "Could not save these cards. Check the Supabase database setup and try again." },
      { status: 500 },
    );
  }

  return Response.json({ saved: rows.length });
}

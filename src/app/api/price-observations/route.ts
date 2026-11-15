import { createHash } from "node:crypto";
import { authenticateRequest } from "@/lib/server-auth";
import { normalizeName, normalizeRarity, priceObservations } from "@/lib/deals";
import { parseMarketplaceText } from "@/lib/parse-marketplace";
import type { HistoricalAverage, HistoricalBid, TrackedPrice } from "@/lib/types";

const RARITY = /^(?:L|UR|SR|R|PC|C)$/u;

export async function POST(request: Request) {
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
  if (!input || typeof input !== "object") {
    return Response.json({ error: "Données invalides." }, { status: 400 });
  }
  const body = input as Record<string, unknown>;
  if (body.action === "record") {
    if (typeof body.text !== "string" || body.text.length > 1_000_000) {
      return Response.json({ error: "Texte du marché invalide ou trop long." }, { status: 400 });
    }
    if (body.pastedAt !== null && (typeof body.pastedAt !== "number" ||
        !Number.isSafeInteger(body.pastedAt) || !Number.isFinite(new Date(body.pastedAt).getTime()))) {
      return Response.json({ error: "Heure du collage invalide." }, { status: 400 });
    }
    const cards = parseMarketplaceText(body.text).cards;
    const captureHash = createHash("sha256").update(body.text).digest("hex");
    const observations = priceObservations(cards, body.pastedAt);
    if (observations.length === 0) return Response.json({ inserted: 0, updated: 0, unmatched: 0, duplicate: false });
    const { data, error } = await authenticated.supabase.rpc("record_price_observations", {
      p_capture_hash: captureHash,
      p_captured_at: body.pastedAt === null ? null : new Date(body.pastedAt).toISOString(),
      p_observations: observations,
    });
    if (error) {
      console.error("Could not save price observations.", error.message);
      return Response.json({ error: "Impossible d’enregistrer les observations de prix." }, { status: 500 });
    }
    if (data.length !== 1) {
      console.error("Unexpected price observation result.");
      return Response.json({ error: "Impossible de confirmer l’enregistrement des observations." }, { status: 500 });
    }
    return Response.json(data[0]);
  }
  if (body.action === "lookup" && Array.isArray(body.keys) && body.keys.length <= 1000) {
    const keys: { name_key: string; card_type: string }[] = [];
    for (const value of body.keys) {
      if (!value || typeof value !== "object" || typeof value.name !== "string" || typeof value.rarity !== "string") {
        return Response.json({ error: "Cartes invalides." }, { status: 400 });
      }
      const name_key = normalizeName(value.name);
      const card_type = normalizeRarity(value.rarity);
      if (name_key.length > 0 && name_key.length <= 200 && RARITY.test(card_type)) keys.push({ name_key, card_type });
    }
    if (keys.length === 0) return Response.json({ summaries: [] });
    const { data, error } = await authenticated.supabase.rpc("price_observation_summaries", { keys });
    if (error) {
      console.error("Could not load price observations.", error.message);
      return Response.json({ error: "Impossible de charger l’historique des prix." }, { status: 500 });
    }
    return Response.json({ summaries: data });
  }
  if (body.action === "tracking") {
    const tracked: TrackedPrice[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await authenticated.supabase.rpc("price_tracking_cards")
        .order("name_key").order("card_type")
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.error("Could not load tracked cards.", error.message);
        return Response.json({ error: "Impossible de charger les cartes suivies." }, { status: 500 });
      }
      tracked.push(...data);
      if (data.length < pageSize) break;
    }
    return Response.json({ tracked });
  }
  if (body.action === "history") {
    if (typeof body.name !== "string" || typeof body.rarity !== "string") {
      return Response.json({ error: "Carte invalide." }, { status: 400 });
    }
    const name = normalizeName(body.name);
    const rarity = normalizeRarity(body.rarity);
    if (!name || name.length > 200 || !RARITY.test(rarity)) {
      return Response.json({ error: "Carte invalide." }, { status: 400 });
    }
    const observations: HistoricalBid[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await authenticated.supabase.from("price_observations")
        .select("current_price, observed_at")
        .eq("name_key", name)
        .eq("card_type", rarity)
        .order("observed_at")
        .order("capture_hash")
        .order("position")
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.error("Could not load price history.", error.message);
        return Response.json({ error: "Impossible de charger l’historique de cette carte." }, { status: 500 });
      }
      observations.push(...data);
      if (data.length < pageSize) break;
    }
    const averages: HistoricalAverage[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await authenticated.supabase.from("average_price_history")
        .select("average_price, recorded_at")
        .eq("user_id", authenticated.user.id)
        .eq("name_key", name)
        .eq("card_type", rarity)
        .order("recorded_at", { nullsFirst: true })
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.error("Could not load average price history.", error.message);
        return Response.json({ error: "Impossible de charger l’historique des moyennes personnelles." }, { status: 500 });
      }
      averages.push(...data);
      if (data.length < pageSize) break;
    }
    return Response.json({ observations, averages });
  }
  return Response.json({ error: "Action invalide." }, { status: 400 });
}

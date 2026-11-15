import { authenticateRequest } from "@/lib/server-auth";
import { normalizeKeyword } from "@/lib/keywords";
import type { Keyword } from "@/lib/types";

export async function GET(request: Request) {
  const authenticated = await authenticateRequest(request);
  if (!authenticated.ok) {
    return Response.json({ error: authenticated.error }, { status: authenticated.status });
  }

  const keywords: Keyword[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await authenticated.supabase
      .from("keywords")
      .select("id, value, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error("Could not load keywords.", error.message);
      return Response.json({ error: "Impossible de charger les mots-clés." }, { status: 500 });
    }
    keywords.push(...data);
    if (data.length < pageSize) break;
  }
  return Response.json({ keywords });
}

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
  const value = input && typeof input === "object" && "value" in input
    ? normalizeKeyword(input.value) : null;
  if (!value) {
    return Response.json({ error: "Saisissez un mot-clé sur une ligne (200 caractères maximum)." }, { status: 400 });
  }

  const { data, error } = await authenticated.supabase
    .from("keywords")
    .insert({ value })
    .select("id, value, created_at")
    .single();
  if (error) {
    console.error("Could not save keyword.", error.message);
    return Response.json({ error: "Impossible d’ajouter le mot-clé." }, { status: 500 });
  }
  return Response.json({ keyword: data }, { status: 201 });
}

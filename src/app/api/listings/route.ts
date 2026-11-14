export async function POST() {
  return Response.json(
    { error: "Les annonces ne sont plus enregistrées." },
    { status: 410 },
  );
}

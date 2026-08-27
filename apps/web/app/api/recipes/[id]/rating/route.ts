import { clearRating, rateRecipe } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ stars: number; review: string | null }>(request);

  return withUser((userId, database) =>
    rateRecipe(database, userId, id, Number(body.stars), body.review ?? null),
  );
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return withUser(async (userId, database) => {
    await clearRating(database, userId, id);
    return { ok: true };
  });
}

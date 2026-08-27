import { createShelf, listShelves } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return withUser((userId, database) => listShelves(database, userId));
}

export async function POST(request: Request) {
  const body = await readJson<{ name: string }>(request);
  return withUser((userId, database) => createShelf(database, userId, body.name ?? ""));
}

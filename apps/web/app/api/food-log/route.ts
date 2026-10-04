import { deleteFoodNote, listFoodNotes, saveFoodNote } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";
export const runtime = "nodejs";
const privateResponse = (response: Response) => { response.headers.set("Cache-Control", "private, no-store"); return response; };
export async function GET(request: Request) {
  return privateResponse(await withUser((userId, database) => listFoodNotes(database, userId, new URL(request.url).searchParams.get("date") ?? undefined)));
}
export async function POST(request: Request) {
  return privateResponse(await withUser(async (userId, database) => saveFoodNote(database, userId, await readJson(request))));
}
export async function DELETE(request: Request) {
  return privateResponse(await withUser(async (userId, database) => { const body = await readJson<{ id: string }>(request); await deleteFoodNote(database, userId, body.id); return { deleted: true }; }));
}

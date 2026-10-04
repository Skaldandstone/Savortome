import { deleteFoodNote, listFoodNotes, saveFoodNote } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";
export const runtime = "nodejs";
const privateResponse = (response: Response) => { response.headers.set("Cache-Control", "private, no-store"); return response; };
export async function GET(request: Request) {
  return privateResponse(await withUser((userId, database) => listFoodNotes(database, userId, new URL(request.url).searchParams.get("date") ?? undefined)));
}
export async function POST(request: Request) {
  return privateResponse(await withUser(async (userId, database) => saveFoodNote(database, userId, await boundedJson(request, 8192))));
}
export async function DELETE(request: Request) {
  return privateResponse(await withUser(async (userId, database) => {
    const body = await boundedJson(request, 1024);
    if (typeof body.id !== "string") throw new BadRequestError("Choose a saved food note to remove.");
    await deleteFoodNote(database, userId, body.id); return { deleted: true };
  }));
}

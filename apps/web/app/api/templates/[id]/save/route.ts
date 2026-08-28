import { saveSharedTemplate } from "@seconds/db";
import { withUser } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Copy someone else's shared meal into your own library. */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  return withUser(async (userId, database) => ({ id: await saveSharedTemplate(database, userId, id) }));
}

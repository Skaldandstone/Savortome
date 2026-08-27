import { adminUserById, creditsFor } from "@seconds/db";
import { withAdmin } from "@/lib/admin";

/** Staff view of one account: identity, tier, and live credit state. */
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return withAdmin(request, async (database) => {
    const user = await adminUserById(database, id);
    if (!user) return undefined;
    return { ...user, credits: await creditsFor(database, id) };
  });
}

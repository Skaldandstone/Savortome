import { adminUserById, purchaseHistory, recentSpends } from "@seconds/db";
import { withAdmin } from "@/lib/admin";

/**
 * Staff view of an account's money trail: what they bought, what they spent.
 * The first stop for "I paid and got nothing" and "why was I charged".
 */
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return withAdmin(request, async (database) => {
    if (!(await adminUserById(database, id))) return undefined;
    return {
      purchases: await purchaseHistory(database, id),
      spends: await recentSpends(database, id),
    };
  });
}

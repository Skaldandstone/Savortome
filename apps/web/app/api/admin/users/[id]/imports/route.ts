import { adminUserById, recentImportsFor } from "@seconds/db";
import { withAdmin } from "@/lib/admin";

/**
 * Staff view of an account's recent recipe imports, traces and errors
 * included — the single best answer to "my import failed".
 */
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return withAdmin(request, async (database) => {
    if (!(await adminUserById(database, id))) return undefined;
    return recentImportsFor(database, id);
  });
}

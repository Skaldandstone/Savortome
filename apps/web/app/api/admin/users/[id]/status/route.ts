import { adminUserById, setUserStatus } from "@seconds/db";
import { BadRequestError, readJson } from "@/lib/api";
import { withAdmin } from "@/lib/admin";

/** Staff action: set an account's moderation state. Reversible. */
export const runtime = "nodejs";

const STATUSES = ["active", "suspended", "banned"] as const;
type Status = (typeof STATUSES)[number];

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ status: Status }>(request);
  return withAdmin(request, async (database) => {
    if (!body.status || !STATUSES.includes(body.status)) {
      throw new BadRequestError(`status must be one of: ${STATUSES.join(", ")}`);
    }
    if (!(await adminUserById(database, id))) return undefined;
    return setUserStatus(database, id, body.status);
  });
}

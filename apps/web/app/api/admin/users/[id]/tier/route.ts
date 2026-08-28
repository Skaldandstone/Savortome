import { adminUserById, setTier } from "@seconds/db";
import { BadRequestError, readJson } from "@/lib/api";
import { withAdmin } from "@/lib/admin";

/** Staff action: set an account's tier (comps, downgrades, billing fixes). */
export const runtime = "nodejs";

const TIERS = ["free", "plus", "pro"] as const;
type Tier = (typeof TIERS)[number];

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ tier: Tier }>(request);
  return withAdmin(request, async (database) => {
    if (!body.tier || !TIERS.includes(body.tier)) {
      throw new BadRequestError(`tier must be one of: ${TIERS.join(", ")}`);
    }
    if (!(await adminUserById(database, id))) return undefined;
    await setTier(database, id, body.tier);
    return { ...(await adminUserById(database, id)) };
  });
}

import { adminUserById, creditsFor, grantCredits } from "@seconds/db";
import { BadRequestError, readJson } from "@/lib/api";
import { withAdmin } from "@/lib/admin";

/** Staff action: grant goodwill/make-good credits to an account. */
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ amount: number }>(request);
  return withAdmin(request, async (database) => {
    const amount = Math.trunc(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) {
      throw new BadRequestError("amount must be a whole number between 1 and 1000");
    }
    if (!(await adminUserById(database, id))) return undefined;
    await grantCredits(database, id, amount);
    return { granted: amount, credits: await creditsFor(database, id) };
  });
}

import { searchUsersByEmail } from "@seconds/db";
import { withAdmin } from "@/lib/admin";

/** Staff lookup: find accounts by (partial) email. */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email") ?? "";
  return withAdmin(request, async (database) =>
    email ? searchUsersByEmail(database, email) : [],
  );
}

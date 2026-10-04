import { requireSignedInPage } from "@/lib/page-auth";
import { TodayScreen } from "@/modules/today/TodayScreen";
export const dynamic = "force-dynamic";
export default async function TodayPage() {
  await requireSignedInPage("/today");
  return <main className="woodland-workspace" data-kitchen-page="today"><header className="woodland-page-heading"><div><h1>Today, at your pace</h1><p>A meal idea or a little memory aid. Use what helps, leave what doesn’t.</p></div></header><TodayScreen /></main>;
}

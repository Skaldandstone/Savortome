import { ImportPanel } from "@/modules/import";
import { LibraryList, LibraryNotice, ShelfFilter } from "@/modules/library";
import { loadLibrary } from "@/lib/library";
import styles from "./layout.module.css";

export const dynamic = "force-dynamic";

async function Library({ shelfId }: { shelfId?: string }) {
  const library = await loadLibrary(shelfId);

  if (library.kind === "unavailable") {
    return <LibraryNotice>{library.reason}</LibraryNotice>;
  }

  return (
    <>
      <ShelfFilter shelves={library.shelves} activeShelfId={shelfId} />
      <LibraryList entries={library.entries} />
    </>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ shelf?: string }>;
}) {
  const { shelf } = await searchParams;

  return (
    <main>
      <ImportPanel />
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Your recipes</h2>
        <Library shelfId={shelf} />
      </section>
    </main>
  );
}

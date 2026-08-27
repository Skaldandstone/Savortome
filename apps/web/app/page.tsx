import { ImportPanel } from "@/modules/import";
import { LibraryList, LibraryNotice, LibrarySearch, ShelfFilter } from "@/modules/library";
import { loadLibrary } from "@/lib/library";
import styles from "./layout.module.css";

export const dynamic = "force-dynamic";

async function Library({ shelfId, query }: { shelfId?: string; query: string }) {
  const library = await loadLibrary(shelfId, query);

  if (library.kind === "unavailable") {
    return <LibraryNotice>{library.reason}</LibraryNotice>;
  }

  return (
    <>
      <LibrarySearch query={query} shelfId={shelfId} />
      <ShelfFilter shelves={library.shelves} activeShelfId={shelfId} query={query} />
      {query && library.entries.length === 0 ? (
        <LibraryNotice>
          Nothing in your recipes matches “{query}”. Discover searches what other people have
          shared.
        </LibraryNotice>
      ) : (
        <LibraryList entries={library.entries} />
      )}
    </>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ shelf?: string; q?: string }>;
}) {
  const { shelf, q } = await searchParams;

  return (
    <main>
      <ImportPanel />
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Your recipes</h2>
        <Library shelfId={shelf} query={q ?? ""} />
      </section>
    </main>
  );
}

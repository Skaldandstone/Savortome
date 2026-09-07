import { ImportPanel } from "@/modules/import";
import {
  LibraryExport,
  LibraryList,
  LibraryNotice,
  LibrarySearch,
  LibrarySort,
  ShelfFilter,
} from "@/modules/library";
import { librarySortOr } from "@seconds/core/format";
import { loadLibrary } from "@/lib/library";
import styles from "./layout.module.css";
import { canUseBeta } from '@/lib/beta';
import { WoodlandLibrary } from '@/modules/library/WoodlandLibrary';

export const dynamic = "force-dynamic";

async function Library({
  shelfId,
  query,
  sort,
}: {
  shelfId?: string;
  query: string;
  sort: string;
}) {
  const order = librarySortOr(sort);
  const library = await loadLibrary(shelfId, query, order);

  if (library.kind === "unavailable") {
    return <LibraryNotice>{library.reason}</LibraryNotice>;
  }

  return (
    <>
      <LibrarySearch query={query} shelfId={shelfId} sort={order} />
      <ShelfFilter
        shelves={library.shelves}
        activeShelfId={shelfId}
        query={query}
        sort={order}
      />
      <LibrarySort sort={order} shelfId={shelfId} query={query} />
      {query && library.entries.length === 0 ? (
        <LibraryNotice>
          Nothing in your recipes matches “{query}”. Discover searches what other people have
          shared.
        </LibraryNotice>
      ) : (
        <LibraryList entries={library.entries} />
      )}
      <LibraryExport total={library.total} />
    </>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ shelf?: string; q?: string; sort?: string }>;
}) {
  const { shelf, q, sort } = await searchParams;
  if (await canUseBeta()) return <WoodlandLibrary shelfId={shelf} query={q ?? ''} sort={sort ?? ''} />;

  return (
    <main>
      <ImportPanel />
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Your recipes</h2>
        <Library shelfId={shelf} query={q ?? ""} sort={sort ?? ""} />
      </section>
    </main>
  );
}

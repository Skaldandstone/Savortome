import Link from 'next/link';
import { librarySortOr } from '@seconds/core/format';
import { loadLibrary } from '@/lib/library';
import { ImportPanel } from '@/modules/import';
import { WebRecipeFinder } from '@/modules/discover';
import { KitchenWelcome, RecipeImportLink } from '@/modules/woodland/Woodland';
import { KitchenIcon } from '@/modules/woodland/KitchenIcon';
import { LibraryExport, LibraryList, LibraryNotice, LibrarySearch, LibrarySort, ShelfFilter } from './index';
import styles from './woodland-library.module.css';
import { NewShelf } from './NewShelf';

export async function WoodlandLibrary({ shelfId, query, sort }: { shelfId?: string; query: string; sort: string }) {
  const order = librarySortOr(sort);
  const library = await loadLibrary(shelfId, query, order);
  const heading = library.kind === 'ok' ? library.shelves.find(shelf => shelf.id === shelfId)?.name ?? 'All recipes' : 'Your recipes';
  return <main className={styles.library}>
    <KitchenWelcome />
    <div className={styles.workspace}>
      <aside className={styles.shelves} aria-labelledby="shelf-heading">
        <header><h2 id="shelf-heading">My shelves</h2><p>A little order for your kitchen.</p></header>
        {library.kind !== 'unavailable' && <NewShelf />}
        {library.kind !== 'unavailable' && <ShelfFilter shelves={library.shelves} activeShelfId={shelfId} query={query} sort={order} />}
        <p className={styles.shelfHint}>Open a recipe to add or arrange its shelves.</p>
        <Link className={styles.journalLink} href="/recipe/new"><KitchenIcon name="plus" />Write a recipe</Link>
      </aside>
      <section className={styles.collection} aria-labelledby="collection-heading">
        <header className={styles.collectionHeading}><div><h2 id="collection-heading">{heading}</h2><p>{library.kind !== 'unavailable' ? `${library.entries.length} recipe${library.entries.length === 1 ? '' : 's'} shown${!query && !shelfId ? ` of ${library.total}` : ' in this view'}` : 'A journal of meals and memories.'}</p></div><RecipeImportLink className={styles.importJump} /></header>
        {library.kind === 'unavailable' ? <LibraryNotice>{library.reason}</LibraryNotice> : <>
          <LibrarySearch query={query} shelfId={shelfId} sort={order} />
          <LibrarySort sort={order} query={query} shelfId={shelfId} />
          {query && library.entries.length === 0 ? <><LibraryNotice>Nothing in your recipes matches “{query}”. <Link href={`/discover?q=${encodeURIComponent(query)}`}>See what others have shared</Link>, or look further afield.</LibraryNotice><WebRecipeFinder query={query} /></> : <LibraryList entries={library.entries} woodland />}
          <Link href="/recipe/new" className={styles.addRecipe}><KitchenIcon name="plus" /><span>Add a recipe to your journal</span></Link>
          <LibraryExport total={library.total} />
        </>}
      </section>
    </div>
    <details id="recipe-import" className={styles.importer}>
      <summary><KitchenIcon name="book" /><span>Bring a recipe into your kitchen<small>From a link, a note, or something you wrote.</small></span><KitchenIcon name="plus" /></summary>
      <ImportPanel />
    </details>
  </main>;
}

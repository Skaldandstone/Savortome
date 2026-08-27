import type { SharedRecipeView } from "@seconds/core/format";
import styles from "./sharing.module.css";

/** Who put this in front of you, and how many people kept it. */
export function SharedByLine({ view }: { view: SharedRecipeView }) {
  return (
    <p className={styles.sharedBy}>
      {view.sharedBy.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.avatar} src={view.sharedBy.avatarUrl} alt="" />
      ) : null}
      Shared by {view.sharedBy.displayName}
      {view.saveCount > 0 ? (
        <span className={styles.saveCount}>
          {" "}
          · saved by {view.saveCount} {view.saveCount === 1 ? "person" : "people"}
        </span>
      ) : null}
    </p>
  );
}

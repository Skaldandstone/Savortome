"use client";

import { Button, Callout, Panel, PanelHeader } from "@/ui";
import { CartButtons } from "./CartButtons";
import { KrogerConnection } from "./KrogerConnection";
import { ListItems } from "./ListItems";
import { useShoppingList } from "./useShoppingList";
import styles from "./list.module.css";

export function ListPanel() {
  const { list, providers, loading, busy, error, handoff, toggle, remove, clear, sendToCart } =
    useShoppingList();

  const outstanding = list ? list.itemCount - list.checkedCount : 0;

  return (
    <>
      <Panel>
        <PanelHeader
          title="Shopping list"
          hint="Ingredients merged across recipes, with anything already in your pantry taken off."
        />

        {loading ? (
          <p className={styles.empty} role="status">
            Loading shopping list…
          </p>
        ) : (
          <>
            {list && list.itemCount > 0 ? (
              <p className={styles.count}>
                {outstanding} to get
                {list.checkedCount > 0 ? ` · ${list.checkedCount} in the basket` : ""}
              </p>
            ) : null}

            <ListItems
              items={list?.items ?? []}
              disabled={busy}
              onToggle={(id, checked) => void toggle(id, checked)}
              onRemove={(id) => void remove(id)}
            />

            {list && list.itemCount > 0 ? (
              <div className={styles.actions}>
                <Button variant="ghost" type="button" disabled={busy} onClick={() => void clear()}>
                  Clear list
                </Button>
              </div>
            ) : null}
          </>
        )}

        {error ? (
          <Callout tone="error" role="alert">
            {error}
          </Callout>
        ) : null}
      </Panel>

      {list && list.itemCount > 0 ? (
        <>
          <CartButtons
            providers={providers}
            disabled={busy}
            handoff={handoff}
            onSend={(provider) => void sendToCart(provider)}
          />
          <KrogerConnection />
        </>
      ) : null}
    </>
  );
}

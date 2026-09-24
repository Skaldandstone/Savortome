"use client";

import { useState } from "react";
import Link from "next/link";
import { signInReturnHref } from "@/lib/action-failure";
import { Button, Callout, Panel, PanelHeader } from "@/ui";
import { CartButtons } from "./CartButtons";
import { KrogerConnection } from "./KrogerConnection";
import { ListItems } from "./ListItems";
import { useShoppingList, type ListController } from "./useShoppingList";
import styles from "./list.module.css";

export function ListPanel() {
  return <ListPanelView shopping={useShoppingList()} />;
}

export function ListPanelView({ shopping }: { shopping: ListController }) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const { list, providers, loading, loaded, busy, error, handoff, toggle, remove, clear, sendToCart } = shopping;

  const outstanding = list ? list.itemCount - list.checkedCount : 0;

  return (
    <>
      <Panel>
        <PanelHeader
          title="Shopping list"
          hint="Ingredients merged across recipes, with anything already in your pantry taken off."
        />

        {loading && !loaded ? (
          <p className={styles.empty} role="status">
            Loading shopping list…
          </p>
        ) : loaded ? (
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
                <Button variant="ghost" type="button" disabled={busy} aria-expanded={confirmingClear} onClick={() => setConfirmingClear(true)}>
                  Clear list
                </Button>
                {confirmingClear ? (
                  <div className={styles.clearConfirm} role="group" aria-label="Confirm clearing shopping list">
                    <span>This removes every item from this list.</span>
                    <Button type="button" variant="danger" disabled={busy} onClick={() => {
                      setConfirmingClear(false);
                      void clear();
                    }}>Clear every item</Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmingClear(false)}>Keep my list</Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {shopping.listError ? (
          <Callout tone="error" role="alert">
            {loaded
              ? "Your shopping list could not refresh. The last list we loaded remains available above."
              : "Your shopping list could not load. Your saved items have not changed."}{" "}
            <Button type="button" variant="ghost" onClick={shopping.retryList}>Try list again</Button>
          </Callout>
        ) : null}

        {error ? (
          <Callout tone="error" role="alert">
            {error.message}
            {error.signInRequired ? <> <Link href={signInReturnHref("/list")}>Sign in again</Link>.</> : null}
          </Callout>
        ) : null}
      </Panel>

      {list && list.itemCount > 0 ? (
        <>
          {shopping.providersLoading && !shopping.providersLoaded ? (
            <p className={styles.empty} role="status">Checking ways to use your list…</p>
          ) : null}
          {shopping.providersLoaded ? (
            <CartButtons
              providers={providers}
              disabled={busy}
              handoff={handoff}
              onSend={(provider) => void sendToCart(provider)}
            />
          ) : null}
          {shopping.providersError ? (
            <Callout tone="error" role="alert">
              {shopping.providersLoaded
                ? "Ways to use your list could not refresh. The last options we loaded remain available above."
                : "Ways to use your list could not load. Your shopping list is still available."}{" "}
              <Button type="button" variant="ghost" onClick={shopping.retryProviders}>Try list options again</Button>
            </Callout>
          ) : null}
          <KrogerConnection />
        </>
      ) : null}
    </>
  );
}

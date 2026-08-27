"use client";

import type { CartHandoff, CartProvider, CartProviderId } from "@seconds/core/format";
import { Button, Callout } from "@/ui";
import styles from "./list.module.css";

/**
 * Where to send the list.
 *
 * Providers with a real cart API and providers that can only be handed a copied
 * list are shown apart, because the difference matters to whoever taps them —
 * one fills a cart, the other opens a shop.
 */
export function CartButtons({
  providers,
  disabled,
  handoff,
  onSend,
}: {
  providers: CartProvider[];
  disabled?: boolean;
  handoff: CartHandoff | null;
  onSend: (provider: CartProviderId) => void;
}) {
  const api = providers.filter((p) => p.kind === "api");
  const handoffs = providers.filter((p) => p.kind === "handoff");

  return (
    <div className={styles.cart}>
      {api.length > 0 ? (
        <div className={styles.cartGroup}>
          <h3 className={styles.cartHeading}>Fill a cart</h3>
          <div className={styles.cartButtons}>
            {api.map((p) => (
              <Button key={p.id} type="button" disabled={disabled} onClick={() => onSend(p.id)}>
                {p.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.cartGroup}>
        <h3 className={styles.cartHeading}>Take the list elsewhere</h3>
        <div className={styles.cartButtons}>
          {handoffs.map((p) => (
            <Button
              key={p.id}
              variant="ghost"
              type="button"
              disabled={disabled}
              title={p.description}
              onClick={() => onSend(p.id)}
            >
              {p.name}
            </Button>
          ))}
        </div>
        <p className={styles.cartNote}>
          DoorDash, Uber Eats, and Safeway have no public cart API, so these copy your list and
          open their store.
        </p>
      </div>

      {handoff ? (
        <Callout tone={handoff.unmatched.length > 0 ? "warn" : "info"} title={handoff.note}>
          {/* Naming what didn't make it is the whole use of saying some didn't:
              a count leaves the shopper to work out which. */}
          {handoff.unmatched.length > 0 ? (
            <ul className={styles.unmatched}>
              {handoff.unmatched.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {handoff.text ? <pre>{handoff.text}</pre> : null}
        </Callout>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button, Callout, FieldRow, Panel, PanelHeader, TextField } from "@/ui";
import { FeedList } from "./FeedList";
import { PersonRow } from "./PersonRow";
import { useFriends } from "./useFriends";
import styles from "./friends.module.css";

/**
 * Friends, requests, and what everyone's been cooking.
 *
 * Requests waiting on you come first — they're the only thing here that needs
 * a decision, and burying them under a feed is how they get ignored.
 */
export function FriendsPanel() {
  const { overview, feed, loading, busy, error, add, update } = useFriends();
  const [handle, setHandle] = useState("");

  return (
    <>
      <Panel>
        <PanelHeader
          title="Friends"
          hint="Add someone by their handle to see what they're cooking, and to share friends-only recipes with them."
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!handle.trim()) return;
            void add(handle).then(() => setHandle(""));
          }}
        >
          <FieldRow>
            <TextField
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@their-handle"
              disabled={busy}
            />
            <Button type="submit" disabled={busy}>
              Add friend
            </Button>
          </FieldRow>
        </form>

        {error ? (
          <Callout tone="error" role="alert">
            {error}
          </Callout>
        ) : null}

        {loading ? <p className={styles.empty}>Loading…</p> : null}

        {overview.incoming.length > 0 ? (
          <section className={styles.group}>
            <h3 className={styles.groupHeading}>
              Waiting on you ({overview.incoming.length})
            </h3>
            <ul className={styles.people}>
              {overview.incoming.map((request) => (
                <PersonRow
                  key={request.person.id}
                  person={request.person}
                  disabled={busy}
                  actions={[
                    {
                      label: "Accept",
                      primary: true,
                      onClick: () => void update(request.person.id, "accept"),
                    },
                    { label: "Decline", onClick: () => void update(request.person.id, "remove") },
                  ]}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {overview.friends.length > 0 ? (
          <section className={styles.group}>
            <h3 className={styles.groupHeading}>Friends ({overview.friends.length})</h3>
            <ul className={styles.people}>
              {overview.friends.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  disabled={busy}
                  actions={[{ label: "Remove", onClick: () => void update(person.id, "remove") }]}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {overview.outgoing.length > 0 ? (
          <section className={styles.group}>
            <h3 className={styles.groupHeading}>Asked ({overview.outgoing.length})</h3>
            <ul className={styles.people}>
              {overview.outgoing.map((request) => (
                <PersonRow
                  key={request.person.id}
                  person={request.person}
                  since="waiting"
                  disabled={busy}
                  actions={[
                    { label: "Withdraw", onClick: () => void update(request.person.id, "remove") },
                  ]}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {!loading &&
        overview.friends.length === 0 &&
        overview.incoming.length === 0 &&
        overview.outgoing.length === 0 ? (
          <p className={styles.empty}>
            No friends yet. Send someone your handle, or add theirs above.
          </p>
        ) : null}
      </Panel>

      <section className={styles.feedSection}>
        <h2 className={styles.feedHeading}>What they&apos;ve been cooking</h2>
        <FeedList items={feed} />
      </section>
    </>
  );
}

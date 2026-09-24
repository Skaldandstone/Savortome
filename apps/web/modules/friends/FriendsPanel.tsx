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
  const {
    overview, feed, loading, feedLoading, feedLoaded, busy, error,
    overviewError, feedError, retryOverview, retryFeed, add, update,
  } = useFriends();
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
            const submittedHandle = handle.trim();
            if (!submittedHandle) return;
            void add(submittedHandle).then((saved) => {
              if (saved) setHandle("");
            });
          }}
        >
          <FieldRow>
            <TextField
              aria-label="Friend's handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@their-handle"
              disabled={busy || loading || Boolean(overviewError)}
            />
            <Button type="submit" disabled={busy || loading || Boolean(overviewError)}>
              Add friend
            </Button>
          </FieldRow>
        </form>

        {error ? (
          <Callout tone="error" role="alert">
            {error}
          </Callout>
        ) : null}

        {overviewError ? (
          <Callout tone="error" role="alert">
            <span>Friends could not load. Your saved relationships have not changed.</span>{" "}
            <Button type="button" variant="ghost" onClick={retryOverview}>Try again</Button>
          </Callout>
        ) : null}

        {loading ? (
          <p className={styles.empty} role="status">
            Loading friends…
          </p>
        ) : null}

        {!loading && !overviewError && overview.incoming.length > 0 ? (
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

        {!loading && !overviewError && overview.friends.length > 0 ? (
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

        {!loading && !overviewError && overview.outgoing.length > 0 ? (
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
        !overviewError &&
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
        {feedLoading ? (
          <p className={styles.empty} role="status">
            {feedLoaded ? "Refreshing recent activity…" : "Loading recent activity…"}
          </p>
        ) : null}
        {feedError ? (
          <Callout tone="error" role="alert">
            <span>{feedLoaded
              ? "Recent activity could not refresh. The last activity we loaded remains below."
              : "Recent activity could not load. Your friends and requests are still shown above."}</span>{" "}
            <Button type="button" variant="ghost" onClick={retryFeed}>Try again</Button>
          </Callout>
        ) : null}
        {feedLoaded ? <FeedList items={feed} /> : null}
      </section>
    </>
  );
}

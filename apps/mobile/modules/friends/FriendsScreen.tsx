import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  describeFeedItem,
  type FeedItem,
  type FriendsOverview,
  type PersonSummary,
} from "@seconds/core/format";
import { api } from "@/lib/client";
import {
  Button,
  Callout,
  Field,
  Panel,
  PanelHeader,
  radius,
  space,
  type as typeScale,
  usePalette,
} from "@/ui";

const EMPTY: FriendsOverview = { friends: [], incoming: [], outgoing: [] };

function Avatar({ person }: { person: PersonSummary }) {
  const c = usePalette();
  if (person.avatarUrl) {
    return (
      <Image
        source={{ uri: person.avatarUrl }}
        style={styles.avatar}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.avatar, styles.avatarBlank, { backgroundColor: c.accentSoft }]}>
      <Text style={{ color: c.accent, fontWeight: "700" }}>
        {person.displayName.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

function PersonRow({
  person,
  actions,
  disabled,
}: {
  person: PersonSummary;
  actions: { label: string; onPress: () => void; primary?: boolean }[];
  disabled?: boolean;
}) {
  const c = usePalette();
  return (
    <View style={[styles.person, { backgroundColor: c.surfaceSunken }]}>
      <Avatar person={person} />
      <View style={styles.personText}>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: typeScale.body }}>
          {person.displayName}
        </Text>
        <Text style={{ color: c.textMuted, fontSize: typeScale.small }}>@{person.handle}</Text>
      </View>
      <View style={styles.personActions}>
        {actions.map((a) => (
          <Button
            key={a.label}
            label={a.label}
            variant={a.primary ? "primary" : "ghost"}
            disabled={disabled}
            onPress={a.onPress}
          />
        ))}
      </View>
    </View>
  );
}

/** Roughly how long ago, in the terms people actually use. */
function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function FeedRow({ item }: { item: FeedItem }) {
  const c = usePalette();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/r/${item.recipeId}`)}
      accessibilityRole="button"
      style={[styles.feedItem, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={[styles.feedThumb, { backgroundColor: c.surfaceSunken }]} />
      <View style={styles.feedText}>
        <Text style={{ color: c.textMuted, fontSize: typeScale.small }}>
          {describeFeedItem(item)}
        </Text>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: typeScale.body }}>
          {item.recipeTitle}
        </Text>
      </View>
      <Text style={{ color: c.textMuted, fontSize: typeScale.micro }}>{ago(item.at)}</Text>
    </Pressable>
  );
}

/** Friends, requests, and what everyone's been cooking. */
export function FriendsScreen() {
  const [overview, setOverview] = useState<FriendsOverview>(EMPTY);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const c = usePalette();

  const load = useCallback(async () => {
    try {
      const [nextOverview, nextFeed] = await Promise.all([api.friends(), api.feed()]);
      setOverview(nextOverview);
      setFeed(nextFeed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your friends.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const act = async (write: () => Promise<FriendsOverview>) => {
    setBusy(true);
    setError(null);
    try {
      setOverview(await write());
      // Accepting a request changes whose activity you can see.
      setFeed(await api.feed());
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  const submitHandle = () => {
    if (!handle.trim()) return;
    void act(() => api.addFriend(handle)).then(() => setHandle(""));
  };

  const nothingYet =
    overview.friends.length === 0 &&
    overview.incoming.length === 0 &&
    overview.outgoing.length === 0;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      <Panel>
        <PanelHeader
          title="Friends"
          hint="Add someone by their handle to see what they're cooking."
        />

        <View style={styles.addRow}>
          <Field
            value={handle}
            onChangeText={setHandle}
            placeholder="@their-handle"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.addInput}
            onSubmitEditing={submitHandle}
          />
          <Button label="Add" disabled={busy || !handle.trim()} onPress={submitHandle} />
        </View>

        {error ? <Callout tone="error">{error}</Callout> : null}

        {overview.incoming.length > 0 ? (
          <View style={styles.group}>
            <Text style={[styles.groupHeading, { color: c.textMuted }]}>
              WAITING ON YOU ({overview.incoming.length})
            </Text>
            {overview.incoming.map((request) => (
              <PersonRow
                key={request.person.id}
                person={request.person}
                disabled={busy}
                actions={[
                  {
                    label: "Accept",
                    primary: true,
                    onPress: () => void act(() => api.updateFriendship(request.person.id, "accept")),
                  },
                  {
                    label: "Decline",
                    onPress: () => void act(() => api.updateFriendship(request.person.id, "remove")),
                  },
                ]}
              />
            ))}
          </View>
        ) : null}

        {overview.friends.length > 0 ? (
          <View style={styles.group}>
            <Text style={[styles.groupHeading, { color: c.textMuted }]}>
              FRIENDS ({overview.friends.length})
            </Text>
            {overview.friends.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                disabled={busy}
                actions={[
                  {
                    label: "Remove",
                    onPress: () => void act(() => api.updateFriendship(person.id, "remove")),
                  },
                ]}
              />
            ))}
          </View>
        ) : null}

        {overview.outgoing.length > 0 ? (
          <View style={styles.group}>
            <Text style={[styles.groupHeading, { color: c.textMuted }]}>
              ASKED ({overview.outgoing.length})
            </Text>
            {overview.outgoing.map((request) => (
              <PersonRow
                key={request.person.id}
                person={request.person}
                disabled={busy}
                actions={[
                  {
                    label: "Withdraw",
                    onPress: () => void act(() => api.updateFriendship(request.person.id, "remove")),
                  },
                ]}
              />
            ))}
          </View>
        ) : null}

        {nothingYet ? (
          <Text style={[styles.empty, { color: c.textMuted }]}>
            No friends yet. Send someone your handle, or add theirs above.
          </Text>
        ) : null}
      </Panel>

      <View style={styles.feedSection}>
        <Text style={[styles.feedHeading, { color: c.text }]}>
          What they&apos;ve been cooking
        </Text>
        {feed.length === 0 ? (
          <Text style={[styles.empty, { color: c.textMuted }]}>
            Nothing here yet. Once your friends cook, rate, or share something, it shows up here.
          </Text>
        ) : (
          feed.map((item) => (
            <FeedRow key={`${item.kind}-${item.recipeId}-${item.at}`} item={item} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg + 4, paddingBottom: space.xxl * 2 },
  addRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  addInput: { flex: 1 },
  group: { marginTop: space.lg },
  groupHeading: {
    fontSize: typeScale.micro,
    letterSpacing: 1,
    fontWeight: "600",
    marginBottom: space.sm,
  },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm + 2,
    borderRadius: radius.sm,
    marginBottom: space.sm,
  },
  avatar: { width: 36, height: 36, borderRadius: 999 },
  avatarBlank: { alignItems: "center", justifyContent: "center" },
  personText: { flex: 1 },
  personActions: { flexDirection: "row", gap: space.xs },
  empty: { fontSize: typeScale.small, marginTop: space.md, lineHeight: 19 },
  feedSection: { marginTop: space.xl },
  feedHeading: { fontSize: typeScale.title, fontWeight: "700", marginBottom: space.md },
  feedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm + 2,
    borderWidth: 1,
    borderRadius: radius.sm,
    marginBottom: space.sm,
  },
  feedThumb: { width: 56, height: 42, borderRadius: 6 },
  feedText: { flex: 1 },
});

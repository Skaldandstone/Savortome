import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { RecipeDraft } from "@nomnom/core/format";
import { Button, Field, space, type as typeScale, usePalette } from "@/ui";

type Setter = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) => void;

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

/** Name and blurb — the only two fields most recipes really need up front. */
export function Basics({ draft, set }: { draft: RecipeDraft; set: Setter }) {
  return (
    <View style={styles.fields}>
      <Labelled label="Name">
        <Field
          value={draft.title}
          placeholder="Weeknight red lentil dal"
          accessibilityLabel="Recipe name"
          onChangeText={(value) => set("title", value)}
        />
      </Labelled>

      <Labelled label="Description" hint="Optional. A line about what it is or when you make it.">
        <Field
          value={draft.description ?? ""}
          multiline
          style={styles.shortArea}
          accessibilityLabel="Description"
          onChangeText={(value) => set("description", value)}
        />
      </Labelled>
    </View>
  );
}

/** Everything that makes a card searchable and scalable, none of it required. */
export function Details({ draft, set }: { draft: RecipeDraft; set: Setter }) {
  const c = usePalette();

  return (
    <View style={styles.fields}>
      <View style={styles.grid}>
        <Labelled label="Serves" style={styles.cell}>
          <NumberField
            label="Serves"
            value={draft.servings}
            onChange={(v) => set("servings", v)}
          />
        </Labelled>
        <Labelled label="Prep (min)" style={styles.cell}>
          <NumberField
            label="Prep minutes"
            value={draft.prepMinutes}
            onChange={(v) => set("prepMinutes", v)}
          />
        </Labelled>
      </View>

      <View style={styles.grid}>
        <Labelled label="Cook (min)" style={styles.cell}>
          <NumberField
            label="Cook minutes"
            value={draft.cookMinutes}
            onChange={(v) => set("cookMinutes", v)}
          />
        </Labelled>
        <Labelled label="Total (min)" style={styles.cell}>
          <NumberField
            label="Total minutes"
            value={draft.totalMinutes}
            onChange={(v) => set("totalMinutes", v)}
          />
        </Labelled>
      </View>
      <Text style={[styles.hint, { color: c.textMuted }]}>
        Leave the total blank and it adds up prep and cook.
      </Text>

      <View style={styles.grid}>
        <Labelled label="Cuisine" style={styles.cell}>
          <Field
            value={draft.cuisine ?? ""}
            placeholder="Thai"
            accessibilityLabel="Cuisine"
            onChangeText={(value) => set("cuisine", value)}
          />
        </Labelled>
        <Labelled label="Course" style={styles.cell}>
          <Field
            value={draft.course ?? ""}
            placeholder="dinner"
            autoCapitalize="none"
            accessibilityLabel="Course"
            onChangeText={(value) => set("course", value)}
          />
        </Labelled>
      </View>

      <Labelled label="Difficulty">
        <View style={styles.options}>
          {DIFFICULTIES.map((option) => (
            <Button
              key={option}
              label={option[0]!.toUpperCase() + option.slice(1)}
              variant="toggle"
              selected={draft.difficulty === option}
              // Tapping the chosen one again clears it — there's no other way
              // back to "I'd rather not say".
              onPress={() => set("difficulty", draft.difficulty === option ? null : option)}
            />
          ))}
        </View>
      </Labelled>

      <ListField
        label="Tags"
        hint="Comma separated. These are what discovery filters on."
        placeholder="weeknight, one-pan, vegetarian"
        values={draft.tags}
        onChange={(values) => set("tags", values)}
      />

      <ListField
        label="Equipment"
        hint="Comma separated."
        placeholder="dutch oven, blender"
        values={draft.equipment}
        onChange={(values) => set("equipment", values)}
      />

      <Labelled label="Photo URL" hint="Optional.">
        <Field
          value={draft.imageUrl ?? ""}
          placeholder="https://…"
          autoCapitalize="none"
          keyboardType="url"
          accessibilityLabel="Photo URL"
          onChangeText={(value) => set("imageUrl", value)}
        />
      </Labelled>

      <Labelled label="Serving note" hint="Optional. “Makes about 12 cookies.”">
        <Field
          value={draft.servingsNote ?? ""}
          accessibilityLabel="Serving note"
          onChangeText={(value) => set("servingsNote", value)}
        />
      </Labelled>
    </View>
  );
}

function Labelled({
  label,
  hint,
  style,
  children,
}: {
  label: string;
  hint?: string;
  style?: object;
  children: ReactNode;
}) {
  const c = usePalette();

  return (
    <View style={[styles.labelled, style]}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label.toUpperCase()}</Text>
      {children}
      {hint ? <Text style={[styles.hint, { color: c.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

/** A number or nothing. An empty box means unknown, which is not the same as 0. */
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field
      value={value === null ? "" : String(value)}
      keyboardType="number-pad"
      accessibilityLabel={label}
      onChangeText={(text) => {
        const digits = text.replace(/[^0-9]/g, "");
        onChange(digits === "" ? null : Number(digits));
      }}
    />
  );
}

/**
 * A comma-separated list. The text stays exactly as typed — splitting on every
 * keystroke without it would eat the comma the moment you pressed it.
 */
function ListField({
  label,
  hint,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [text, setText] = useState(values.join(", "));

  return (
    <Labelled label={label} hint={hint}>
      <Field
        value={text}
        placeholder={placeholder}
        autoCapitalize="none"
        accessibilityLabel={label}
        onChangeText={(next) => {
          setText(next);
          onChange(next.split(",").map((part) => part.trim()));
        }}
      />
    </Labelled>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.md },
  grid: { flexDirection: "row", gap: space.md },
  cell: { flex: 1 },
  labelled: { gap: 5 },
  label: { fontSize: typeScale.micro, letterSpacing: 1, fontWeight: "600" },
  hint: { fontSize: typeScale.small, lineHeight: 18 },
  shortArea: { minHeight: 72 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});

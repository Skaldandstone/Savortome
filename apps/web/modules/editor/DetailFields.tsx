"use client";

import { useState } from "react";
import type { RecipeDraft } from "@nomnom/core/format";
import { TextArea, TextField } from "@/ui";
import styles from "./editor.module.css";

type Setter = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) => void;

/** Name and blurb — the only two fields most recipes really need up front. */
export function Basics({ draft, set }: { draft: RecipeDraft; set: Setter }) {
  return (
    <div className={styles.fields}>
      <Labelled label="Name">
        <TextField
          value={draft.title}
          placeholder="Weeknight red lentil dal"
          autoFocus
          onChange={(e) => set("title", e.target.value)}
        />
      </Labelled>

      <Labelled label="Description" hint="Optional. A line about what it is or when you make it.">
        <TextArea
          value={draft.description ?? ""}
          rows={2}
          className={styles.shortArea}
          onChange={(e) => set("description", e.target.value)}
        />
      </Labelled>
    </div>
  );
}

/** Everything that makes a card searchable and scalable, none of it required. */
export function Details({ draft, set }: { draft: RecipeDraft; set: Setter }) {
  return (
    <div className={styles.fields}>
      <div className={styles.grid}>
        <Labelled label="Serves">
          <NumberField value={draft.servings} onChange={(v) => set("servings", v)} />
        </Labelled>
        <Labelled label="Prep (min)">
          <NumberField value={draft.prepMinutes} onChange={(v) => set("prepMinutes", v)} />
        </Labelled>
        <Labelled label="Cook (min)">
          <NumberField value={draft.cookMinutes} onChange={(v) => set("cookMinutes", v)} />
        </Labelled>
        <Labelled label="Total (min)" hint="Left blank, this adds up prep and cook.">
          <NumberField value={draft.totalMinutes} onChange={(v) => set("totalMinutes", v)} />
        </Labelled>
      </div>

      <div className={styles.grid}>
        <Labelled label="Cuisine">
          <TextField
            value={draft.cuisine ?? ""}
            placeholder="Thai"
            onChange={(e) => set("cuisine", e.target.value)}
          />
        </Labelled>
        <Labelled label="Course">
          <TextField
            value={draft.course ?? ""}
            placeholder="dinner"
            list="nomnom-courses"
            onChange={(e) => set("course", e.target.value)}
          />
          <datalist id="nomnom-courses">
            {["breakfast", "lunch", "dinner", "dessert", "snack", "side", "drink", "sauce"].map(
              (course) => (
                <option key={course} value={course} />
              ),
            )}
          </datalist>
        </Labelled>
        <Labelled label="Difficulty">
          <select
            className={styles.select}
            value={draft.difficulty ?? ""}
            onChange={(e) =>
              set("difficulty", (e.target.value || null) as RecipeDraft["difficulty"])
            }
          >
            <option value="">—</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </Labelled>
      </div>

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
        <TextField
          value={draft.imageUrl ?? ""}
          inputMode="url"
          placeholder="https://…"
          onChange={(e) => set("imageUrl", e.target.value)}
        />
      </Labelled>

      <Labelled label="Serving note" hint="Optional. “Makes about 12 cookies.”">
        <TextField
          value={draft.servingsNote ?? ""}
          onChange={(e) => set("servingsNote", e.target.value)}
        />
      </Labelled>
    </div>
  );
}

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.labelled}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}

/** A number or nothing. An empty box means unknown, which is not the same as 0. */
function NumberField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <TextField
      type="number"
      min={0}
      inputMode="numeric"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
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
      <TextField
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.split(",").map((part) => part.trim()));
        }}
      />
    </Labelled>
  );
}

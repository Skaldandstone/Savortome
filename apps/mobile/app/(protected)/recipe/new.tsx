import { emptyDraft } from "@seconds/core/format";
import { RecipeEditorScreen } from "@/modules/editor";

/** Write a recipe from nothing. The other half of importing one. */
export default function NewRecipeRoute() {
  return <RecipeEditorScreen initial={emptyDraft()} />;
}

import { ingredientFromLine, normalizeDraft, validateDraft, type RecipeDraft } from "./editor.js";
import type { SkillDemands } from "./recipe.js";

export const STARTER_RECIPE_AUTHOR = {
  id: "5a70f70e-5eed-4d8f-9000-000000000001",
  catalogueId: "savortome-starter-catalogue-v1",
  email: "starter-recipes@savortome.local",
  handle: "savortome-kitchen",
  displayName: "Savortome Kitchen",
} as const;

export interface StarterRecipe {
  id: string;
  slug: string;
  draft: RecipeDraft;
  skillDemands: SkillDemands;
}

type StarterInput = Omit<RecipeDraft, "ingredients" | "steps" | "imageUrl"> & {
  id: string;
  slug: string;
  ingredients: string[];
  steps: string[];
  skillDemands: SkillDemands;
};

function starter(input: StarterInput): StarterRecipe {
  const draft = normalizeDraft({
    ...input,
    imageUrl: null,
    ingredients: input.ingredients.map((line) => ingredientFromLine(line)),
    steps: input.steps.map((text, index) => ({
      n: index + 1,
      text,
      timerSeconds: null,
      sourceTimestamp: null,
    })),
  });
  validateDraft(draft);
  return { id: input.id, slug: input.slug, draft, skillDemands: input.skillDemands };
}

const easySkills: SkillDemands = { knife: 1, stovetop: 1, oven: 1, timing: 1 };

/**
 * Original starter recipes that make a new Savortome account useful.
 * They contain no medical or allergen-safety claims. Dietary labels describe
 * ingredients as written; people still need to check their own packages.
 */
export const STARTER_RECIPES: readonly StarterRecipe[] = [
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000101", slug: "banana-oat-muffins",
    title: "Banana oat muffins", description: "A forgiving way to use soft, spotty bananas.",
    servings: 12, servingsNote: "12 muffins", prepMinutes: 15, cookMinutes: 20, totalMinutes: 35,
    ingredients: ["3 ripe bananas, mashed", "2 eggs", "1/3 cup neutral oil", "1/3 cup brown sugar", "1 teaspoon vanilla extract", "1 1/2 cups rolled oats", "1 cup all-purpose flour", "1 teaspoon baking soda", "1/2 teaspoon ground cinnamon", "1/4 teaspoon salt"],
    steps: ["Heat the oven to 350°F (175°C). Line or lightly grease a 12-cup muffin pan.", "Whisk the mashed bananas, eggs, oil, brown sugar, and vanilla in a large bowl.", "Stir in the oats, flour, baking soda, cinnamon, and salt just until no dry flour remains.", "Divide the batter evenly among 12 muffin cups.", "Bake for 18 to 22 minutes, until the tops spring back lightly. Cool for 5 minutes before removing from the pan."],
    equipment: ["12-cup muffin pan", "large bowl", "whisk"], tags: ["breakfast", "baking", "use-it-up", "vegetarian"], cuisine: null, course: "breakfast", difficulty: "easy", skillDemands: { ...easySkills, oven: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000102", slug: "tomato-white-bean-soup",
    title: "Tomato white bean soup", description: "A pantry-friendly soup with a short ingredient list.",
    servings: 4, servingsNote: null, prepMinutes: 10, cookMinutes: 25, totalMinutes: 35,
    ingredients: ["1 tablespoon olive oil", "1 small onion, diced", "2 cloves garlic, minced", "1 28-ounce can crushed tomatoes", "2 15-ounce cans white beans, drained and rinsed", "2 cups vegetable broth", "1 teaspoon dried oregano", "1/2 teaspoon salt", "black pepper to taste", "2 cups baby spinach, optional"],
    steps: ["Warm the olive oil in a large pot over medium heat.", "Add the onion and cook for 5 minutes, stirring occasionally.", "Add the garlic and oregano and stir for 30 seconds.", "Add the tomatoes, beans, broth, salt, and pepper. Bring to a gentle simmer.", "Simmer for 15 minutes. Stir in the spinach, if using, and cook until wilted."],
    equipment: ["large pot", "wooden spoon"], tags: ["soup", "pantry", "one-pot", "vegetarian"], cuisine: null, course: "dinner", difficulty: "easy", skillDemands: { ...easySkills, knife: 2, stovetop: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000103", slug: "sheet-pan-chickpeas-vegetables",
    title: "Sheet-pan chickpeas and vegetables", description: "Crisp-edged vegetables and chickpeas with one pan to wash.",
    servings: 4, servingsNote: null, prepMinutes: 15, cookMinutes: 30, totalMinutes: 45,
    ingredients: ["1 15-ounce can chickpeas, drained and rinsed", "1 bell pepper, chopped", "1 zucchini, chopped", "1 small red onion, chopped", "2 tablespoons olive oil", "1 teaspoon smoked paprika", "1/2 teaspoon garlic powder", "1/2 teaspoon salt", "1 lemon, cut into wedges"],
    steps: ["Heat the oven to 425°F (220°C).", "Pat the chickpeas dry. Put them on a sheet pan with the bell pepper, zucchini, and onion.", "Add the olive oil, smoked paprika, garlic powder, and salt. Toss until evenly coated.", "Spread everything into one layer and roast for 25 to 30 minutes, stirring once halfway through.", "Squeeze lemon over the pan before serving."],
    equipment: ["sheet pan", "large spoon"], tags: ["one-pan", "vegetarian", "weeknight"], cuisine: null, course: "dinner", difficulty: "easy", skillDemands: { ...easySkills, knife: 2, oven: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000104", slug: "stovetop-apple-oatmeal",
    title: "Stovetop apple oatmeal", description: "Warm oats with apple and cinnamon in about fifteen minutes.",
    servings: 2, servingsNote: null, prepMinutes: 5, cookMinutes: 10, totalMinutes: 15,
    ingredients: ["1 cup rolled oats", "2 cups milk or water", "1 apple, diced", "1/2 teaspoon ground cinnamon", "1 pinch salt", "1 tablespoon maple syrup, optional"],
    steps: ["Put the oats, milk or water, apple, cinnamon, and salt in a small saucepan.", "Bring to a gentle simmer over medium heat, stirring often.", "Cook for 5 to 7 minutes, until the oats are tender and creamy.", "Divide between bowls and add maple syrup, if using."],
    equipment: ["small saucepan", "wooden spoon"], tags: ["breakfast", "quick", "vegetarian"], cuisine: null, course: "breakfast", difficulty: "easy", skillDemands: { ...easySkills, stovetop: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000105", slug: "black-bean-quesadillas",
    title: "Black bean quesadillas", description: "Crisp tortillas with beans, cheese, and a quick corn filling.",
    servings: 4, servingsNote: "4 quesadillas", prepMinutes: 10, cookMinutes: 15, totalMinutes: 25,
    ingredients: ["1 15-ounce can black beans, drained and rinsed", "1 cup frozen corn, thawed", "1/2 teaspoon ground cumin", "1 1/2 cups shredded cheese", "8 small flour tortillas", "1 tablespoon neutral oil"],
    steps: ["Mash half of the beans in a bowl. Stir in the remaining beans, corn, and cumin.", "Spread the filling over 4 tortillas. Add the cheese and top with the remaining tortillas.", "Warm a thin layer of oil in a skillet over medium heat.", "Cook each quesadilla for 2 to 3 minutes per side, until crisp and the cheese melts.", "Rest for 1 minute, then cut into wedges."],
    equipment: ["mixing bowl", "large skillet", "spatula"], tags: ["quick", "vegetarian", "weeknight"], cuisine: "Mexican-inspired", course: "lunch", difficulty: "easy", skillDemands: { ...easySkills, stovetop: 2, timing: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000106", slug: "red-lentil-dal",
    title: "Simple red lentil dal", description: "A gently spiced one-pot lentil dinner.",
    servings: 4, servingsNote: null, prepMinutes: 10, cookMinutes: 30, totalMinutes: 40,
    ingredients: ["1 tablespoon neutral oil", "1 small onion, diced", "2 cloves garlic, minced", "1 tablespoon grated fresh ginger", "1 teaspoon ground cumin", "1 teaspoon ground turmeric", "1 cup red lentils, rinsed", "1 14-ounce can diced tomatoes", "3 cups water", "1/2 teaspoon salt", "1/2 lemon"],
    steps: ["Warm the oil in a medium pot over medium heat.", "Cook the onion for 5 minutes. Add the garlic, ginger, cumin, and turmeric and stir for 30 seconds.", "Add the lentils, tomatoes, water, and salt. Bring to a simmer.", "Cook uncovered for 20 to 25 minutes, stirring occasionally, until the lentils are soft. Add a splash of water if it becomes too thick.", "Squeeze in the lemon and taste for seasoning."],
    equipment: ["medium pot", "wooden spoon"], tags: ["one-pot", "vegetarian", "pantry"], cuisine: "Indian-inspired", course: "dinner", difficulty: "easy", skillDemands: { ...easySkills, knife: 2, stovetop: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000107", slug: "egg-fried-rice",
    title: "Egg fried rice", description: "A quick meal for cold leftover rice and whatever vegetables are handy.",
    servings: 3, servingsNote: null, prepMinutes: 10, cookMinutes: 10, totalMinutes: 20,
    ingredients: ["3 cups cooked rice, chilled", "2 eggs, beaten", "1 cup frozen peas and carrots", "2 tablespoons neutral oil, divided", "2 tablespoons soy sauce", "2 green onions, sliced, optional"],
    steps: ["Break up any clumps in the cold rice before you start cooking.", "Heat 1 tablespoon oil in a large skillet over medium-high heat. Add the eggs and stir until just set, then move them to a plate.", "Add the remaining oil and the frozen vegetables. Cook for 3 minutes.", "Add the rice and cook for 3 to 4 minutes, stirring and pressing out clumps.", "Return the eggs to the pan. Add the soy sauce and green onions, if using, and toss until hot."],
    equipment: ["large skillet", "spatula"], tags: ["quick", "use-it-up", "weeknight"], cuisine: "Chinese-inspired", course: "dinner", difficulty: "easy", skillDemands: { ...easySkills, stovetop: 3, timing: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000108", slug: "spinach-tomato-pasta",
    title: "Tomato spinach pasta", description: "A straightforward pantry pasta with greens folded in at the end.",
    servings: 4, servingsNote: null, prepMinutes: 5, cookMinutes: 20, totalMinutes: 25,
    ingredients: ["12 ounces pasta", "1 tablespoon olive oil", "2 cloves garlic, minced", "1 14-ounce can diced tomatoes", "1/2 teaspoon dried oregano", "4 cups baby spinach", "1/2 teaspoon salt", "1/4 cup grated Parmesan, optional"],
    steps: ["Bring a large pot of salted water to a boil. Cook the pasta according to its package directions; reserve 1/2 cup cooking water before draining.", "Warm the olive oil in a large skillet over medium heat. Add the garlic and cook for 30 seconds.", "Add the tomatoes, oregano, and salt. Simmer for 8 minutes.", "Stir in the spinach until wilted, then add the drained pasta.", "Toss with a splash of reserved pasta water as needed. Add Parmesan, if using."],
    equipment: ["large pot", "large skillet", "colander"], tags: ["quick", "weeknight", "vegetarian"], cuisine: "Italian-inspired", course: "dinner", difficulty: "easy", skillDemands: { ...easySkills, stovetop: 2, timing: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000109", slug: "loaded-baked-potatoes",
    title: "Bean-topped baked potatoes", description: "Crisp baked potatoes turned into a simple pantry meal.",
    servings: 4, servingsNote: null, prepMinutes: 10, cookMinutes: 55, totalMinutes: 65,
    ingredients: ["4 medium russet potatoes", "1 teaspoon olive oil", "1/2 teaspoon salt", "1 15-ounce can pinto beans, drained and rinsed", "1 cup shredded cheese", "1/2 cup plain yogurt or sour cream", "2 green onions, sliced, optional"],
    steps: ["Heat the oven to 425°F (220°C). Scrub and dry the potatoes, prick them with a fork, and rub with oil and salt.", "Bake directly on the oven rack for 45 to 60 minutes, until easily pierced with a knife.", "Warm the beans in a small saucepan or microwave-safe bowl.", "Split each potato and fluff the inside with a fork.", "Top with beans, cheese, yogurt or sour cream, and green onions, if using."],
    equipment: ["fork", "small saucepan or microwave-safe bowl"], tags: ["pantry", "vegetarian", "hands-off"], cuisine: null, course: "dinner", difficulty: "easy", skillDemands: { ...easySkills, oven: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000110", slug: "lemon-herb-rice",
    title: "Lemon herb rice", description: "A bright side dish made in one covered pot.",
    servings: 4, servingsNote: null, prepMinutes: 5, cookMinutes: 20, totalMinutes: 25,
    ingredients: ["1 cup long-grain white rice", "1 1/2 cups water or broth", "1 tablespoon olive oil", "1/2 teaspoon salt", "1 lemon", "2 tablespoons chopped parsley, optional"],
    steps: ["Rinse the rice in a fine-mesh strainer until the water runs mostly clear.", "Put the rice, water or broth, olive oil, and salt in a small saucepan. Bring to a boil.", "Cover, reduce the heat to low, and cook for 15 minutes without lifting the lid.", "Remove from the heat and rest, still covered, for 5 minutes.", "Zest half the lemon over the rice, add 1 tablespoon lemon juice and the parsley, if using, then fluff with a fork."],
    equipment: ["fine-mesh strainer", "small saucepan with lid", "fork"], tags: ["side", "pantry", "vegetarian"], cuisine: null, course: "side", difficulty: "easy", skillDemands: { ...easySkills, stovetop: 2, timing: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000111", slug: "vegetable-frittata",
    title: "Use-what-you-have vegetable frittata", description: "Eggs and leftover cooked vegetables become an easy breakfast or dinner.",
    servings: 6, servingsNote: null, prepMinutes: 10, cookMinutes: 20, totalMinutes: 30,
    ingredients: ["8 eggs", "1/4 cup milk", "1/2 teaspoon salt", "black pepper to taste", "1 tablespoon olive oil", "2 cups chopped cooked vegetables", "1/2 cup shredded cheese, optional"],
    steps: ["Heat the oven to 375°F (190°C). Whisk the eggs, milk, salt, and pepper in a bowl.", "Warm the oil in an oven-safe 10-inch skillet over medium heat. Add the cooked vegetables and heat through.", "Pour in the egg mixture. Cook without stirring for 3 minutes, until the edges begin to set.", "Add the cheese, if using, and move the skillet to the oven.", "Bake for 10 to 14 minutes, until the center is just set. Rest for 5 minutes before slicing."],
    equipment: ["mixing bowl", "whisk", "10-inch oven-safe skillet"], tags: ["breakfast", "use-it-up", "vegetarian"], cuisine: null, course: "breakfast", difficulty: "easy", skillDemands: { ...easySkills, stovetop: 2, oven: 2, timing: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000112", slug: "yogurt-fruit-crunch-bowls",
    title: "Yogurt, fruit, and crunch bowls", description: "A no-cook breakfast assembled from flexible components.",
    servings: 2, servingsNote: null, prepMinutes: 5, cookMinutes: 0, totalMinutes: 5,
    ingredients: ["2 cups plain yogurt", "1 cup fruit, fresh or thawed from frozen", "1/2 cup granola or toasted oats", "2 tablespoons nut or seed butter, optional", "2 teaspoons honey or maple syrup, optional"],
    steps: ["Divide the yogurt between two bowls.", "Add the fruit and granola or toasted oats.", "Drizzle with nut or seed butter and honey or maple syrup, if using. Check package labels for ingredients that matter to you."],
    equipment: ["2 bowls", "spoon"], tags: ["breakfast", "no-cook", "quick", "vegetarian"], cuisine: null, course: "breakfast", difficulty: "easy", skillDemands: { ...easySkills },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000113", slug: "chickpea-cucumber-pitas",
    title: "Chickpea cucumber pitas", description: "A cool, crunchy lunch with no stove to manage.",
    servings: 2, servingsNote: "2 filled pitas", prepMinutes: 10, cookMinutes: 0, totalMinutes: 10,
    ingredients: ["1 15-ounce can chickpeas, drained and rinsed", "1/2 cucumber, diced", "2 tablespoons plain yogurt", "1 tablespoon lemon juice", "1/4 teaspoon salt", "2 pita breads"],
    steps: ["Mash the chickpeas roughly in a bowl with a fork.", "Stir in the cucumber, yogurt, lemon juice, and salt.", "Split the 2 pitas and divide the filling between them. Serve immediately."],
    equipment: ["bowl", "fork", "knife"], tags: ["lunch", "no-cook", "vegetarian", "quick"], cuisine: null, course: "lunch", difficulty: "easy", skillDemands: { ...easySkills, knife: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000114", slug: "hummus-carrot-wraps",
    title: "Hummus carrot wraps", description: "A short assembly recipe for a day when cooking feels like a lot.",
    servings: 2, servingsNote: "2 wraps", prepMinutes: 10, cookMinutes: 0, totalMinutes: 10,
    ingredients: ["2 large flour tortillas", "1/2 cup hummus", "1 carrot, grated", "1 cup baby spinach", "1/2 cucumber, sliced"],
    steps: ["Spread 1/4 cup hummus over each tortilla, leaving a small border around the edge.", "Divide the carrot, spinach, and cucumber between the tortillas.", "Fold the sides inward, then roll from the bottom to enclose the filling. Cut in half if helpful."],
    equipment: ["grater", "knife", "board"], tags: ["lunch", "no-cook", "vegetarian", "quick"], cuisine: null, course: "lunch", difficulty: "easy", skillDemands: { ...easySkills, knife: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000115", slug: "couscous-peas-lemon",
    title: "Couscous with peas and lemon", description: "Tiny pasta that steeps while you take a breather.",
    servings: 2, servingsNote: null, prepMinutes: 5, cookMinutes: 10, totalMinutes: 15,
    ingredients: ["1 cup instant couscous", "1 cup water", "1 cup frozen peas", "1 tablespoon olive oil", "1 tablespoon lemon juice", "1/4 teaspoon salt"],
    steps: ["Check that the couscous is the instant variety, not pearl couscous; use the package's liquid ratio if different.", "Bring the water to a boil in a small saucepan. Add the peas and simmer for 3 minutes, or follow their package cooking directions.", "Remove from the heat. Stir in the couscous, olive oil, and salt. Cover for the package's standing time, usually 5 minutes.", "Fluff with a fork and stir in the lemon juice."],
    equipment: ["small saucepan with lid", "fork"], tags: ["lunch", "quick", "vegetarian"], cuisine: null, course: "lunch", difficulty: "easy", skillDemands: { ...easySkills, stovetop: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000116", slug: "peanut-lime-noodles",
    title: "Peanut lime noodles", description: "A creamy sauce stirred in a bowl while the noodles cook.",
    servings: 2, servingsNote: null, prepMinutes: 10, cookMinutes: 10, totalMinutes: 20,
    ingredients: ["6 ounces dried noodles", "3 tablespoons smooth peanut butter", "1 tablespoon soy sauce", "1 tablespoon lime juice", "1 teaspoon maple syrup", "3 tablespoons warm water", "1 carrot, grated"],
    steps: ["Cook the noodles according to their package directions.", "In a bowl, stir the peanut butter, soy sauce, lime juice, maple syrup, and 3 tablespoons warm water until smooth. Add a little more water if needed to make a pourable sauce.", "Drain the noodles and toss with the sauce and grated carrot. Divide between 2 bowls."],
    equipment: ["saucepan", "colander", "bowl", "grater"], tags: ["quick", "vegetarian", "weeknight"], cuisine: null, course: "dinner", difficulty: "easy", skillDemands: { ...easySkills, stovetop: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000117", slug: "broccoli-cheddar-toast",
    title: "Broccoli cheddar toast", description: "A small warm meal using cooked broccoli and a slice of bread.",
    servings: 2, servingsNote: "2 topped slices", prepMinutes: 5, cookMinutes: 10, totalMinutes: 15,
    ingredients: ["2 thick slices bread", "1 cup cooked broccoli, chopped", "1 teaspoon olive oil", "1/2 cup grated cheddar cheese", "black pepper to taste"],
    steps: ["Heat the oven to 400°F (200°C). Put the bread on a baking sheet.", "Toss the cooked broccoli with the olive oil and pepper. Divide between the bread slices.", "Top each slice with 1/4 cup cheddar. Bake for 8 to 10 minutes, until the cheese melts and the topping is hot."],
    equipment: ["baking sheet", "bowl"], tags: ["lunch", "use-it-up", "vegetarian", "quick"], cuisine: null, course: "lunch", difficulty: "easy", skillDemands: { ...easySkills, oven: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000118", slug: "sweet-potato-black-bean-bowls",
    title: "Sweet potato black bean bowls", description: "Roasted sweet potato with warm beans and a cool yogurt topping.",
    servings: 2, servingsNote: null, prepMinutes: 10, cookMinutes: 30, totalMinutes: 40,
    ingredients: ["2 medium sweet potatoes, cut into 3/4-inch cubes", "1 tablespoon olive oil", "1/2 teaspoon ground cumin", "1/4 teaspoon salt", "1 15-ounce can black beans, drained and rinsed", "1/4 cup plain yogurt", "1 tablespoon lime juice"],
    steps: ["Heat the oven to 425°F (220°C). Toss the sweet potato cubes with the oil, cumin, and salt on a baking sheet.", "Spread into one layer. Roast for 25 to 30 minutes, turning halfway through, until a fork slides easily into the cubes.", "Warm the beans in a small saucepan with 2 tablespoons water, stirring until hot.", "Stir the yogurt and lime juice together. Divide the sweet potato and beans between 2 bowls and spoon the yogurt over them."],
    equipment: ["baking sheet", "small saucepan", "bowl", "knife"], tags: ["dinner", "vegetarian", "weeknight"], cuisine: null, course: "dinner", difficulty: "easy", skillDemands: { ...easySkills, knife: 2, oven: 2, timing: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000119", slug: "mushroom-bean-skillet",
    title: "Mushroom white bean skillet", description: "A warm skillet meal with a short list of ingredients.",
    servings: 2, servingsNote: null, prepMinutes: 10, cookMinutes: 15, totalMinutes: 25,
    ingredients: ["1 tablespoon olive oil", "8 ounces mushrooms, sliced", "1 clove garlic, minced", "1 15-ounce can white beans, drained and rinsed", "1/4 cup vegetable broth", "2 cups baby spinach", "1/4 teaspoon salt"],
    steps: ["Heat the oil in a skillet over medium heat. Add the mushrooms and cook for 8 minutes, stirring occasionally, until softened and browned in places.", "Add the garlic and stir for 30 seconds.", "Add the beans, broth, and salt. Simmer for 4 minutes, stirring gently.", "Stir in the spinach until wilted. Divide between 2 bowls."],
    equipment: ["skillet", "spoon", "knife"], tags: ["one-pan", "vegetarian", "quick"], cuisine: null, course: "dinner", difficulty: "easy", skillDemands: { ...easySkills, knife: 2, stovetop: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000120", slug: "overnight-apple-oats",
    title: "Overnight apple oats", description: "Mix tonight, refrigerate, and have breakfast ready tomorrow.",
    servings: 2, servingsNote: "2 jars; includes 8 hours refrigerated soaking", prepMinutes: 10, cookMinutes: 0, totalMinutes: 490,
    ingredients: ["1 cup rolled oats", "1 cup milk", "1/2 cup plain yogurt", "1 apple, grated", "1/2 teaspoon ground cinnamon", "2 teaspoons maple syrup, optional"],
    steps: ["Stir the oats, milk, yogurt, grated apple, cinnamon, and maple syrup, if using, in a bowl.", "Divide between 2 covered containers and refrigerate overnight, at least 8 hours. Preparation takes 10 minutes; the total includes the overnight wait.", "In the morning, stir and add a splash of milk if you want a looser texture. Keep refrigerated until serving."],
    equipment: ["bowl", "grater", "2 covered containers"], tags: ["breakfast", "make-ahead", "no-cook", "vegetarian"], cuisine: null, course: "breakfast", difficulty: "easy", skillDemands: { ...easySkills },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000121", slug: "tomato-cucumber-toast",
    title: "Tomato cucumber toast", description: "Crunchy vegetables over creamy hummus, with optional toasting.",
    servings: 2, servingsNote: "2 topped slices", prepMinutes: 10, cookMinutes: 0, totalMinutes: 10,
    ingredients: ["2 slices bread", "1/4 cup hummus", "1 tomato, diced", "1/2 cucumber, diced", "1 teaspoon olive oil", "black pepper to taste"],
    steps: ["Toast the bread if you want, or use it as it is.", "Spread 2 tablespoons hummus over each slice.", "Mix the tomato and cucumber with the olive oil and pepper. Divide over the bread and serve immediately."],
    equipment: ["knife", "board", "bowl", "toaster, optional"], tags: ["lunch", "no-cook", "vegetarian", "quick"], cuisine: null, course: "lunch", difficulty: "easy", skillDemands: { ...easySkills, knife: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000122", slug: "warm-butter-beans-peas",
    title: "Warm butter beans and peas", description: "A soft, spoonable lunch made from a can and the freezer.",
    servings: 2, servingsNote: null, prepMinutes: 5, cookMinutes: 10, totalMinutes: 15,
    ingredients: ["1 15-ounce can butter beans, drained and rinsed", "1 cup frozen peas", "1/2 cup vegetable broth", "1 tablespoon olive oil", "1 tablespoon lemon juice", "black pepper to taste"],
    steps: ["Put the beans, peas, broth, and olive oil in a small saucepan.", "Bring to a gentle simmer over medium heat. Cook for 5 to 7 minutes, stirring occasionally, until hot; follow the peas' package directions if they require longer.", "Mash a few beans with the back of the spoon to thicken the broth. Stir in the lemon juice and pepper."],
    equipment: ["small saucepan", "spoon"], tags: ["lunch", "pantry", "vegetarian", "quick"], cuisine: null, course: "lunch", difficulty: "easy", skillDemands: { ...easySkills, stovetop: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000123", slug: "roasted-carrots-chickpeas",
    title: "Roasted carrots and chickpeas", description: "A tray of familiar ingredients with a lemon yogurt spoonful.",
    servings: 2, servingsNote: null, prepMinutes: 10, cookMinutes: 30, totalMinutes: 40,
    ingredients: ["4 carrots, cut into 1/2-inch pieces", "1 15-ounce can chickpeas, drained and rinsed", "1 tablespoon olive oil", "1/2 teaspoon ground cumin", "1/4 teaspoon salt", "1/4 cup plain yogurt", "1 tablespoon lemon juice"],
    steps: ["Heat the oven to 425°F (220°C). Pat the chickpeas dry.", "Toss the carrots and chickpeas with the oil, cumin, and salt on a baking sheet. Spread into one layer.", "Roast for 25 to 30 minutes, turning halfway through, until the carrots are tender when pierced.", "Mix the yogurt and lemon juice in a small bowl. Divide the roasted vegetables between 2 plates and add the yogurt."],
    equipment: ["baking sheet", "knife", "small bowl"], tags: ["dinner", "vegetarian", "one-pan"], cuisine: null, course: "dinner", difficulty: "easy", skillDemands: { ...easySkills, knife: 2, oven: 2 },
  }),
  starter({
    id: "5a70f70e-5eed-4d8f-9000-000000000124", slug: "cinnamon-pear-yogurt",
    title: "Cinnamon pear yogurt", description: "A small no-cook breakfast or snack with soft fruit and crunch.",
    servings: 1, servingsNote: null, prepMinutes: 5, cookMinutes: 0, totalMinutes: 5,
    ingredients: ["3/4 cup plain yogurt", "1 ripe pear, diced", "1/4 cup granola", "1 pinch ground cinnamon"],
    steps: ["Spoon the yogurt into a bowl.", "Add the diced pear and granola. Sprinkle the cinnamon over the top.", "Stir together or leave the components separate, whichever texture you prefer."],
    equipment: ["bowl", "spoon", "knife"], tags: ["breakfast", "snack", "no-cook", "vegetarian", "quick"], cuisine: null, course: "breakfast", difficulty: "easy", skillDemands: { ...easySkills },
  }),
] as const;

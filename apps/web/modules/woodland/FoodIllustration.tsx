import type { CSSProperties } from 'react';

// Coordinates map directly to the authored catalogue, never to inferred recipes.
const cells: Record<string, number> = { banana: 0, apple: 1, applesauce: 2, crackers: 3, yogurt: 4, hummus: 5, cereal: 6, rice: 7, oatmeal: 8, beans: 9, potato: 10, scramble: 11, pasta: 12, peas: 13, journal: 14 };
export function FoodIllustration({ foodId, className = '' }: { foodId: string; className?: string }) {
  const index = cells[foodId];
  if (index === undefined) return null;
  const style = { '--food-x': `${(index % 4) * 100 / 3}%`, '--food-y': `${Math.floor(index / 4) * 100 / 3}%` } as CSSProperties;
  return <span aria-hidden="true" className={`woodland-food-art ${className}`} style={style} />;
}

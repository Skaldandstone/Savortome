import { canUseBeta } from '@/lib/beta';
import { KitchenIcon, type KitchenIconName } from './KitchenIcon';

/** Server-selected page framing; the legacy routes keep their original header. */
export async function KitchenPageHeading({ title, description, icon }: {
  title: string;
  description: string;
  icon: KitchenIconName;
}) {
  if (!(await canUseBeta())) return null;
  return <header className="woodland-page-heading">
    <span className="woodland-page-emblem"><KitchenIcon name={icon} /></span>
    <div><h1>{title}</h1><p>{description}</p></div>
  </header>;
}

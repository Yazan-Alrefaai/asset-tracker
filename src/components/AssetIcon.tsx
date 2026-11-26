import { Banknote, Bitcoin, Building2, ChartCandlestick, Coins, Gem } from 'lucide-react';
import { TYPE_COLOR_VAR, type AssetType } from '../lib/model';

const ICONS: Record<AssetType, typeof Coins> = {
  gold: Coins,
  silver: Gem,
  crypto: Bitcoin,
  stock: ChartCandlestick,
  cash: Banknote,
  manual: Building2,
};

/** Type icon in the type's chart colour (identity mark beside the text, never the text itself). */
export function AssetIcon({ type, size = 'md' }: { type: AssetType; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = ICONS[type];
  const box = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const icon = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const color = TYPE_COLOR_VAR[type];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg ${box}`}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      aria-hidden
    >
      <Icon className={icon} />
    </span>
  );
}

export function TypeDot({ type }: { type: AssetType }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLOR_VAR[type] }} aria-hidden />;
}

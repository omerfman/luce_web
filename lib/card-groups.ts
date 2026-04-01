/**
 * Kart grupları: son 4 + sahip adı ile anahtar (liste, filtre, detay tutarlılığı).
 */

export function makeCardGroupKey(cardLastFour: string, holder: string): string {
  const f = (cardLastFour || '').trim();
  const h = (holder || '').trim() || '—';
  return `${f}|||${h}`;
}

export function makeCardGroupKeyFromRow(
  item: { card_last_four?: string | null; card_holder_name?: string | null },
  stmt: { card_last_four?: string | null; card_holder_name?: string | null }
): string {
  const lastFour = (item.card_last_four || stmt.card_last_four || '').trim();
  const holder = (item.card_holder_name || stmt.card_holder_name || '').trim() || '—';
  return makeCardGroupKey(lastFour, holder);
}

export function parseCardKey(cardKey: string): { lastFour: string; holder: string } {
  const sep = '|||';
  const i = cardKey.indexOf(sep);
  if (i === -1) return { lastFour: (cardKey || '').trim(), holder: '—' };
  return {
    lastFour: cardKey.slice(0, i).trim(),
    holder: cardKey.slice(i + sep.length).trim() || '—',
  };
}

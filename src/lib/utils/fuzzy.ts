// Lightweight fuzzy-name matcher used by /services and /inventory to warn
// admins before they create a duplicate of an existing item. Intentionally
// simple — no external dependencies — optimised for short Spanish product
// and service names (2-40 chars typical).

// Normalizes for comparison:
//  - lowercase
//  - strip accents (NFD + remove combining marks)
//  - trim + collapse internal whitespace
// Input "Corté Dé Cabello " becomes "corte de cabello".
export function normalizeName(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// Standard Levenshtein edit distance. O(n*m) in memory + time, but names are
// short enough that this is effectively instant even on a 200-item list.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

// Returns a 0..1 similarity score for two names.
// 1.0 = identical after normalisation. Substring overlap gets a 0.9 floor so
// "Corte" vs "Corte de cabello" always surfaces as a strong match. Otherwise
// fall back to a Levenshtein-derived ratio scaled by the longer string.
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length >= 3 && nb.length >= 3) {
    if (na.includes(nb) || nb.includes(na)) return 0.9;
  }
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

// Default threshold tuned for salon names — anything ≥ 0.7 is "probably a dup".
export const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

// Returns up to `limit` items from `items` whose `name` field scores above
// `threshold` against `query`. Skips an item whose id matches `excludeId`
// (so edit flows don't flag the item against itself).
export function findSimilarByName<T extends { id: string; name: string }>(
  query: string,
  items: readonly T[],
  opts: { threshold?: number; limit?: number; excludeId?: string } = {},
): T[] {
  const threshold = opts.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const limit = opts.limit ?? 3;
  const excludeId = opts.excludeId ?? '';
  if (!query || normalizeName(query).length < 2) return [];
  return items
    .filter((it) => it.id !== excludeId)
    .map((it) => ({ item: it, score: nameSimilarity(query, it.name) }))
    .filter((x) => x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item);
}

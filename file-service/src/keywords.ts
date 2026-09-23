const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "had", "her", "was",
  "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "new", "now",
  "old", "see", "two", "way", "who", "boy", "did", "man", "men", "put", "say", "she",
  "too", "use", "that", "this", "with", "have", "from", "they", "been", "were", "said",
  "each", "which", "their", "will", "there", "what", "when", "your", "than", "then",
  "them", "these", "some", "would", "into", "more", "other", "about", "could", "only",
  "http", "https", "www", "com", "org", "net",
]);

const MAX_TOKEN_LEN = 40;

export function extractKeywords(text: string, limit = 60): string[] {
  if (!text.trim()) return [];

  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}._-]+/u)
    .map((t) => t.replace(/^[._-]+|[._-]+$/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const earlyCutoff = Math.max(1, Math.floor(tokens.length * 0.1));
  const scores = new Map<string, number>();

  tokens.forEach((token, i) => {
    if (token.length < 3 || token.length > MAX_TOKEN_LEN) return;
    if (STOPWORDS.has(token)) return;

    if (!/[\p{L}\p{N}]/u.test(token)) return;

    let weight = 1;
    if (i < earlyCutoff) weight += 1;
    if (/\d/.test(token)) weight += 1;
    scores.set(token, (scores.get(token) ?? 0) + weight);
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

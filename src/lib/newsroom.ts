import { z } from 'zod';
import type { NewsGroupItem, RankedNewsItem } from '@/types';

export const sourceSchema = z.object({ id: z.string().max(150), name: z.string().min(1).max(150), url: z.string().url().max(2048), region: z.enum(['france', 'europe', 'monde']), enabled: z.boolean(), notes: z.string().max(500) });
export type NewsSource = z.infer<typeof sourceSchema>;
export const newsItemSchema = z.object({ id: z.string(), title: z.string().min(1).max(1000), link: z.string().url(), source: z.string(), sourceId: z.string(), pubDate: z.string(), region: z.enum(['france', 'europe', 'monde']), relatedSources: z.array(z.string()), sourceCount: z.number().int().min(1) });
export const trendingSchema = z.object({ items: z.array(newsItemSchema), sources: z.array(z.object({ id: z.string(), ok: z.boolean(), count: z.number(), error: z.string().optional() })), cachedAt: z.string() });
export type TrendingResult = z.infer<typeof trendingSchema>;
export const rankingSchema = z.object({ items: z.array(z.object({ id: z.string().max(500), score: z.number().min(1).max(10), category: z.enum(['france', 'europe', 'monde']), reason: z.string().max(250).refine(s => s.trim().split(/\s+/u).length <= 15, '15 mots maximum') })).max(40) });
export const DUPLICATE_THRESHOLD = 0.65;
const stopWords = new Set('les des une pour dans avec sur par est aux qui que son ses leur cette plus après entre selon'.split(' '));
export function titleTokens(title: string) {
  return new Set(title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stopWords.has(w)));
}
export function groupNews(items: NewsGroupItem[], threshold = DUPLICATE_THRESHOLD): NewsGroupItem[] {
  const groups: NewsGroupItem[] = [];
  for (const item of items) {
    const a = titleTokens(item.title);
    const group = groups.find(g => {
      if (g.link === item.link) return true;
      const b = titleTokens(g.title);
      const overlap = [...a].filter(t => b.has(t)).length;
      return Math.min(a.size, b.size) >= 3 && overlap / Math.max(a.size, b.size) >= threshold;
    });
    if (group) {
      group.relatedSources = [...new Set([...group.relatedSources, item.source])];
      group.sourceCount = group.relatedSources.length;
    } else {
      groups.push({ ...newsItemSchema.parse(item), relatedSources: [item.source], sourceCount: 1 });
    }
  }
  return groups;
}
export function selectDiverse(items: RankedNewsItem[], limit = 5): RankedNewsItem[] {
  const pending = [...items];
  const result: RankedNewsItem[] = [];
  const counts = { france: 0, europe: 0, monde: 0 };
  while (pending.length && result.length < limit) {
    let index = pending.findIndex(i => counts[i.category] < 2);
    if (index < 0) index = 0;
    const item = pending.splice(index, 1)[0];
    if (!item || result.some(r => r.id === item.id)) continue;
    counts[item.category]++;
    result.push(item);
  }
  return result;
}
export function automaticRanking(items: NewsGroupItem[]): RankedNewsItem[] {
  const sorted = [...items].sort((a, b) => b.sourceCount - a.sourceCount || (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  return selectDiverse(sorted.map(i => ({ ...i, score: Math.min(10, i.sourceCount * 2), category: i.region, reason: i.sourceCount > 1 ? `Couvert par ${i.sourceCount} sources.` : 'Classé selon la date de publication.', isAiRanked: false })));
}
export function applyRatings(items: NewsGroupItem[], input: unknown): RankedNewsItem[] {
  const validated = rankingSchema.parse(input);
  const known = new Map(items.map(i => [i.id, i]));
  const seen = new Set<string>();
  const rated: RankedNewsItem[] = [];
  for (const rating of validated.items) {
    const original = known.get(rating.id);
    if (!original || seen.has(rating.id)) continue;
    seen.add(rating.id);
    rated.push({ ...original, ...rating, score: Math.min(10, rating.score + Math.min(2.5, (original.sourceCount - 1) * 0.75)), isAiRanked: true });
  }
  if (!rated.length) throw new Error('Aucun identifiant connu');
  return selectDiverse(rated.sort((a, b) => b.score - a.score));
}
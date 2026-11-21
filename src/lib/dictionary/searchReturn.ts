import { searchHref } from '@/lib/navigation';

export type SearchOrigin = { query: string; result?: string };

type Param = string | string[] | null | undefined;

export function readSearchOrigin(from: Param, result: Param): SearchOrigin | undefined {
  const query = typeof from === 'string' ? from.trim() : '';
  if (query) return { query, result: typeof result === 'string' ? result : undefined };
}

export function withSearchOrigin(href: string, origin?: SearchOrigin): string {
  if (!origin?.query) return href;
  const params = new URLSearchParams({ from: origin.query });
  if (origin.result) params.set('result', origin.result);
  return `${href}${href.includes('?') ? '&' : '?'}${params}`;
}

export function searchReturnHref(origin: SearchOrigin): string {
  return origin.query.trim() ? `${searchHref(origin.query)}&focus=${encodeURIComponent(origin.result || 'results')}` : '/';
}

export function searchResultId(href: string, group: 'word' | 'base' = 'word'): string {
  return `${group}-result-${href}`;
}

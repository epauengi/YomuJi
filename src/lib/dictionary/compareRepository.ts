import type { TermRecord, KanjiRecord } from '@/types/dictionary';
import type { DictionaryRepository, SearchTermsInput, SearchTermsResult, SearchKanjiInput, SearchKanjiResult } from './types';
import { SupabaseDictionaryRepository } from './supabaseRepository';
import { TursoDictionaryRepository } from './tursoRepository';

export class CompareDictionaryRepository implements DictionaryRepository {
  private primaryRepo: SupabaseDictionaryRepository;
  private shadowRepo: TursoDictionaryRepository;

  constructor() {
    this.primaryRepo = new SupabaseDictionaryRepository();
    this.shadowRepo = new TursoDictionaryRepository();
  }

  async searchTerms(input: SearchTermsInput): Promise<SearchTermsResult> {
    const t0 = performance.now();
    const primaryRes = await this.primaryRepo.searchTerms(input);
    const durationPrimary = (performance.now() - t0).toFixed(2);

    const t1 = performance.now();
    this.shadowRepo
      .searchTerms(input)
      .then((shadowRes) => {
        const durationShadow = (performance.now() - t1).toFixed(2);
        const match = primaryRes.terms.map((t) => t.term.id).join(',') === shadowRes.terms.map((t) => t.term.id).join(',');
        console.log(
          `[CompareRepo] searchTerms query="${input.query}" | Supabase: ${primaryRes.terms.length} items (${durationPrimary}ms) | Turso: ${shadowRes.terms.length} items (${durationShadow}ms) | Match: ${match}`
        );
      })
      .catch((err) => {
        console.error('[CompareRepo] Turso searchTerms failed:', err.message);
      });

    return primaryRes;
  }

  async searchKanji(input: SearchKanjiInput): Promise<SearchKanjiResult> {
    const t0 = performance.now();
    const primaryRes = await this.primaryRepo.searchKanji(input);
    const durationPrimary = (performance.now() - t0).toFixed(2);

    const t1 = performance.now();
    this.shadowRepo
      .searchKanji(input)
      .then((shadowRes) => {
        const durationShadow = (performance.now() - t1).toFixed(2);
        console.log(
          `[CompareRepo] searchKanji query="${input.query}" | Supabase: ${primaryRes.kanji.length} items (${durationPrimary}ms) | Turso: ${shadowRes.kanji.length} items (${durationShadow}ms)`
        );
      })
      .catch((err) => {
        console.error('[CompareRepo] Turso searchKanji failed:', err.message);
      });

    return primaryRes;
  }

  async getTermByIdOrSlug(slug: string): Promise<TermRecord | null> {
    const primaryRes = await this.primaryRepo.getTermByIdOrSlug(slug);

    this.shadowRepo.getTermByIdOrSlug(slug).then((shadowRes) => {
      if (Boolean(primaryRes) !== Boolean(shadowRes)) {
        console.warn(`[CompareRepo] getTermByIdOrSlug discrepancy for slug="${slug}"`);
      }
    }).catch(() => {});

    return primaryRes;
  }

  async getKanjiByLiteral(literal: string): Promise<KanjiRecord | null> {
    const primaryRes = await this.primaryRepo.getKanjiByLiteral(literal);

    this.shadowRepo.getKanjiByLiteral(literal).then((shadowRes) => {
      if (Boolean(primaryRes) !== Boolean(shadowRes)) {
        console.warn(`[CompareRepo] getKanjiByLiteral discrepancy for literal="${literal}"`);
      }
    }).catch(() => {});

    return primaryRes;
  }
}

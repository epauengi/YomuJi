import type { TermRecord } from '@/types/dictionary';

export function TermWrittenForms({ term, query = '' }: {
  term: Pick<TermRecord, 'surface' | 'writtenForms'>;
  query?: string;
}) {
  const key = query.trim().normalize('NFKC');
  const forms = [...new Set([term.surface, ...(term.writtenForms ?? [])])];
  // Keep the headword first, followed by the spelling the learner searched for.
  const match = forms.findIndex((form) => form.normalize('NFKC') === key);
  if (match > 1) forms.splice(1, 0, ...forms.splice(match, 1));

  return forms.map((form, index) => (
    <span key={form}>
      {index > 0 && '、'}
      {form.normalize('NFKC') === key ? (
        <mark className="rounded bg-[var(--color-highlight)] px-0.5 text-[var(--color-text-primary)]">{form}</mark>
      ) : form}
    </span>
  ));
}

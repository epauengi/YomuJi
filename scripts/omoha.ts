import type { ExampleRecord, TermSense } from '../src/types/dictionary';

// Omoha contains JMdict entity names without a DTD; decode text entities, not POS codes.
function xmlText(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1].toLowerCase() === 'x';
      const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : match;
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[entity.toLowerCase()] || match;
  }).trim();
}

function fields(xml: string, tag: string): string[] {
  return Array.from(xml.matchAll(new RegExp(`<${tag}(?=\\s|>)(?:\\s[^>]*?)?(?<!/)>([\\s\\S]*?)<\\/${tag}>`, 'g')),
    (match) => xmlText(match[1])).filter(Boolean);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.normalize('NFC').toLocaleLowerCase('vi');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseOmohaEntry(entry: string, sequence: number): {
  writtenForms: string[];
  readingForms: string[];
  senses: TermSense[];
  examples: ExampleRecord[];
} {
  const writtenForms = unique(fields(entry, 'keb'));
  const readingForms = unique(fields(entry, 'reb'));
  const examples: ExampleRecord[] = [];
  let inheritedPos: string[] = [];
  const senses = Array.from(entry.matchAll(/<sense>([\s\S]*?)<\/sense>/g), (match): TermSense => {
    const xml = match[1];
    const explicitPos = fields(xml, 'pos').map((value) => value.replace(/^&([^;]+);$/, '$1'));
    if (explicitPos.length) inheritedPos = unique(explicitPos);
    const senseExamples = Array.from(xml.matchAll(/<example>([\s\S]*?)<\/example>/g), (exampleMatch) => {
      const example = exampleMatch[1];
      const textJa = example.match(/<ex_sent\s+[^>]*xml:lang=["']jpn["'][^>]*>([\s\S]*?)<\/ex_sent>/)?.[1];
      const textVi = example.match(/<ex_sent\s+[^>]*xml:lang=["']vi["'][^>]*>([\s\S]*?)<\/ex_sent>/)?.[1];
      if (!textJa || !textVi) return null;
      const record: ExampleRecord = {
        id: `ex-${sequence}-${examples.length + 1}`,
        termSequence: sequence,
        textJa: xmlText(textJa),
        textVi: xmlText(textVi),
        highlight: fields(example, 'ex_text')[0] || undefined,
      };
      if (!record.textJa || !record.textVi) return null;
      examples.push(record);
      return record;
    }).filter((example): example is ExampleRecord => example !== null);
    return {
      meaningsVi: unique(fields(xml, 'gloss')),
      partOfSpeech: [...inheritedPos],
      misc: unique(fields(xml, 'misc').map((value) => value.replace(/^&([^;]+);$/, '$1'))),
      appliesToKanji: unique(fields(xml, 'stagk')),
      appliesToReadings: unique(fields(xml, 'stagr')),
      examples: senseExamples,
    };
  });
  return { writtenForms, readingForms, senses, examples };
}

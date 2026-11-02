import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOmohaEntry } from './omoha';

// ponytail: inline fixtures cover core XML parser rules; add full JMdict DTD/stream tests if switching parser.

test('parseOmohaEntry: 打つ fixture with distinct senses, POS inheritance/switch, and examples', () => {
  const utsuXml = `
    <entry>
      <ent_seq>1400970</ent_seq>
      <k_ele><keb>打つ</keb></k_ele>
      <k_ele><keb>討つ</keb></k_ele>
      <k_ele><keb>撃つ</keb></k_ele>
      <r_ele><reb>うつ</reb></r_ele>
      <sense>
        <pos>&v5t;</pos>
        <gloss>đánh; đập; gõ</gloss>
        <example>
          <ex_sent xml:lang="jpn">彼は太鼓を&apos;トントン&apos;と打った。</ex_sent>
          <ex_sent xml:lang="vi">Anh &amp; em nghe ti&#x1EBF;ng anh &#x0111;&#xE1;nh tr&#x1ED1;ng.</ex_sent>
          <ex_text>打つ</ex_text>
        </example>
      </sense>
      <sense>
        <stagk>撃つ</stagk>
        <gloss>bắn (súng)</gloss>
        <example>
          <ex_sent xml:lang="jpn">銃を撃つ</ex_sent>
          <ex_sent xml:lang="vi">Bắn súng</ex_sent>
        </example>
      </sense>
      <sense>
        <pos>&n;</pos>
        <gloss xml:lang="vi">
          đòn đánh;
          cú đánh
        </gloss>
        <gloss>ĐÒN ĐÁNH;
          CÚ ĐÁNH</gloss>
      </sense>
    </entry>
  `;

  const result = parseOmohaEntry(utsuXml, 1400970);

  assert.deepEqual(result.writtenForms, ['打つ', '討つ', '撃つ']);
  assert.deepEqual(result.readingForms, ['うつ']);
  assert.equal(result.senses.length, 3);

  // Sense 0: explicit POS, examples with highlight and decoded entities
  const sense0 = result.senses[0];
  assert.deepEqual(sense0.partOfSpeech, ['v5t']);
  assert.deepEqual(sense0.meaningsVi, ['đánh; đập; gõ']);
  assert.equal(sense0.examples.length, 1);
  assert.deepEqual(sense0.examples[0], {
    id: 'ex-1400970-1',
    termSequence: 1400970,
    textJa: "彼は太鼓を'トントン'と打った。",
    textVi: 'Anh & em nghe tiếng anh đánh trống.',
    highlight: '打つ',
  });

  // Sense 1: inherited POS, stagk restriction, example without ex_text
  const sense1 = result.senses[1];
  assert.deepEqual(sense1.partOfSpeech, ['v5t']);
  assert.deepEqual(sense1.appliesToKanji, ['撃つ']);
  assert.deepEqual(sense1.meaningsVi, ['bắn (súng)']);
  assert.equal(sense1.examples.length, 1);
  assert.deepEqual(sense1.examples[0], {
    id: 'ex-1400970-2',
    termSequence: 1400970,
    textJa: '銃を撃つ',
    textVi: 'Bắn súng',
    highlight: undefined,
  });

  // Sense 2: switched POS to noun, multi-line trimmed gloss, duplicate gloss deduped case/NFC, no examples
  const sense2 = result.senses[2];
  assert.deepEqual(sense2.partOfSpeech, ['n']);
  assert.deepEqual(sense2.meaningsVi, ['đòn đánh;\n          cú đánh']);
  assert.deepEqual(sense2.examples, []);

  // Root examples aggregation and IDs
  assert.equal(result.examples.length, 2);
  assert.equal(result.examples[0].id, 'ex-1400970-1');
  assert.equal(result.examples[1].id, 'ex-1400970-2');
});

test('parseOmohaEntry: 上手 fixture with stagk/stagr restrictions and misc entities', () => {
  const jouzuXml = `
    <entry>
      <ent_seq>1343050</ent_seq>
      <k_ele><keb>上手</keb></k_ele>
      <r_ele><reb>じょうず</reb></r_ele>
      <r_ele><reb>かみて</reb></r_ele>
      <r_ele><reb>じょうて</reb></r_ele>
      <sense>
        <pos>&adj-na;</pos>
        <pos>&n;</pos>
        <stagr>じょうず</stagr>
        <gloss>khéo léo; giỏi</gloss>
      </sense>
      <sense>
        <pos>&n;</pos>
        <stagr>かみて</stagr>
        <gloss>phía bên phải sân khấu</gloss>
      </sense>
      <sense>
        <stagk>上手</stagk>
        <stagr>じょうて</stagr>
        <misc>&arch;</misc>
        <gloss>thượng thủ; người bề trên</gloss>
      </sense>
    </entry>
  `;

  const result = parseOmohaEntry(jouzuXml, 1343050);

  assert.deepEqual(result.writtenForms, ['上手']);
  assert.deepEqual(result.readingForms, ['じょうず', 'かみて', 'じょうて']);
  assert.equal(result.senses.length, 3);

  // Sense 0: restricted to reading じょうず
  assert.deepEqual(result.senses[0].partOfSpeech, ['adj-na', 'n']);
  assert.deepEqual(result.senses[0].appliesToReadings, ['じょうず']);
  assert.deepEqual(result.senses[0].appliesToKanji, []);

  // Sense 1: restricted to reading かみて
  assert.deepEqual(result.senses[1].partOfSpeech, ['n']);
  assert.deepEqual(result.senses[1].appliesToReadings, ['かみて']);

  // Sense 2: inherits POS 'n', restricted to kanji 上手 and reading じょうて, decodes misc &arch; -> arch
  assert.deepEqual(result.senses[2].partOfSpeech, ['n']);
  assert.deepEqual(result.senses[2].appliesToKanji, ['上手']);
  assert.deepEqual(result.senses[2].appliesToReadings, ['じょうて']);
  assert.deepEqual(result.senses[2].misc, ['arch']);
  assert.deepEqual(result.senses[2].meaningsVi, ['thượng thủ; người bề trên']);
});

test('parseOmohaEntry: self-closing gloss never consumes the next one', () => {
  const result = parseOmohaEntry('<sense><pos>&n;</pos><gloss/><gloss>quân đội</gloss><gloss g_type="lit">nghĩa đen</gloss></sense>', 7);
  assert.deepEqual(result.senses[0].meaningsVi, ['quân đội', 'nghĩa đen']);
});

test('parseOmohaEntry: missing forms, malformed examples, and numeric/named entity decoding', () => {
  const edgeXml = `
    <entry>
      <ent_seq>99999</ent_seq>
      <r_ele><reb>ただ</reb></r_ele>
      <sense>
        <pos>&adv;</pos>
        <gloss>&quot;&#x3042;&amp;&#12354;&quot; &#xd800; &lt;test&gt;</gloss>
        <example>
          <!-- Missing vi translation -->
          <ex_sent xml:lang="jpn">ただの人</ex_sent>
        </example>
        <example>
          <!-- Missing jpn sentence -->
          <ex_sent xml:lang="vi">Người bình thường</ex_sent>
        </example>
        <example>
          <!-- Valid example with sequence numbering -->
          <ex_sent xml:lang="jpn">ただいま</ex_sent>
          <ex_sent xml:lang="vi">Tôi đã về</ex_sent>
        </example>
      </sense>
    </entry>
  `;

  const result = parseOmohaEntry(edgeXml, 99999);

  // Kana-only entry: empty written forms
  assert.deepEqual(result.writtenForms, []);
  assert.deepEqual(result.readingForms, ['ただ']);

  // Decoded numeric and XML entities; invalid surrogate preserved without crash
  assert.deepEqual(result.senses[0].meaningsVi, ['"あ&あ" &#xd800; <test>']);

  // Only the complete example survived
  assert.equal(result.senses[0].examples.length, 1);
  assert.deepEqual(result.senses[0].examples[0], {
    id: 'ex-99999-1',
    termSequence: 99999,
    textJa: 'ただいま',
    textVi: 'Tôi đã về',
    highlight: undefined,
  });
  assert.equal(result.examples.length, 1);
  assert.equal(result.examples[0].id, 'ex-99999-1');
});

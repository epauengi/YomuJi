// Run: node scripts/check-jlpt.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

class MockNextRequest {
  constructor(url, init = {}) {
    this.url = url;
    this._headers = new Map(
      Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    );
    this._body = init.body || '';
  }
  get headers() {
    return {
      get: (name) => this._headers.get(name.toLowerCase()) || null,
    };
  }
  async text() {
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }
}

const mockNextServer = {
  NextRequest: MockNextRequest,
  NextResponse: {
    json: (data, init = {}) => ({
      status: init.status || 200,
      data,
      json: async () => data,
      headers: new Map(Object.entries(init.headers || {})),
    }),
  },
};

function loadModule(filePath, extraImports = {}) {
  const fullPath = path.resolve(process.cwd(), filePath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exportsObj = {};
  const moduleObj = { exports: exportsObj };

  const customRequire = (id) => {
    if (id in extraImports) return extraImports[id];
    if (id === 'node:fs' || id === 'fs') return fs;
    if (id === 'node:path' || id === 'path') return path;
    if (id === 'node:assert/strict') return assert;
    if (id === './jlpt' || id === '@/lib/jlpt') {
      return loadModule('src/lib/jlpt.ts', extraImports);
    }
    if (id === './jlptData' || id === '@/lib/jlptData') {
      return loadModule('src/lib/jlptData.ts', extraImports);
    }
    if (id === 'next/server') {
      return mockNextServer;
    }
    return require(id);
  };

  const sandbox = {
    exports: exportsObj,
    module: moduleObj,
    require: customRequire,
    process,
    Buffer,
    console,
    URL,
    URLSearchParams,
    Set,
    Map,
    Array,
    Object,
    Number,
    String,
    Math,
    JSON,
    Error,
    TypeError,
  };

  vm.runInNewContext(code, sandbox);
  return moduleObj.exports;
}

async function runTests() {
  console.log('--- Checking File Locations & Security ---');
  // 1. Verify no public/jlpt leftovers
  const publicJlpt = path.join(process.cwd(), 'public', 'jlpt');
  assert.ok(!fs.existsSync(publicJlpt), 'public/jlpt directory must not exist');

  // 2. Verify data/jlpt files exist
  const examsFile = path.join(process.cwd(), 'data', 'jlpt', 'n2-exams.json');
  const keysFile = path.join(process.cwd(), 'data', 'jlpt', 'n2-answer-key.json');
  assert.ok(fs.existsSync(examsFile), 'data/jlpt/n2-exams.json must exist');
  assert.ok(fs.existsSync(keysFile), 'data/jlpt/n2-answer-key.json must exist');

  // 3. Verify exams file has no embedded answer_keys
  const rawExams = JSON.parse(fs.readFileSync(examsFile, 'utf8'));
  assert.equal(rawExams.answer_keys, undefined, 'data/jlpt/n2-exams.json must NOT contain embedded answer_keys');
  assert.equal(rawExams.metadata.total_exams, 10);
  assert.equal(rawExams.metadata.complete_exams_count, 10);
  assert.equal(rawExams.metadata.total_parts, 30);

  // 4. Load independent answer keys for regression testing
  const rawKeys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
  assert.equal(rawKeys.metadata.total_exams, 10);
  const independentKeyMap = new Map();
  for (const items of Object.values(rawKeys.answer_keys)) {
    for (const item of items) {
      independentKeyMap.set(item.id, item);
    }
  }
  assert.equal(independentKeyMap.size, 750, 'Independent answer keys must contain 750 answers');

  console.log('--- Testing jlpt.ts ---');
  const jlpt = loadModule('src/lib/jlpt.ts');

  // Verify CATEGORIES label 'Từ vựng / Kanji'
  assert.equal(jlpt.CATEGORIES.length, 3);
  const ids = Array.from(jlpt.CATEGORIES).map((c) => c.id);
  assert.equal(ids[0], 'vocabulary_kanji');
  assert.equal(ids[1], 'grammar');
  assert.equal(ids[2], 'reading');
  assert.equal(jlpt.CATEGORIES[0].label, 'Từ vựng / Kanji');
  assert.equal(jlpt.CATEGORIES[1].label, 'Ngữ pháp');
  assert.equal(jlpt.CATEGORIES[2].label, 'Đọc hiểu');

  // Verify remainingSeconds
  const now = 1000000;
  assert.equal(jlpt.remainingSeconds(now + 5000, now), 5);
  assert.equal(jlpt.remainingSeconds(now + 4200, now), 5); // Math.ceil
  assert.equal(jlpt.remainingSeconds(now + 4001, now), 5);
  assert.equal(jlpt.remainingSeconds(now + 4000, now), 4);
  assert.equal(jlpt.remainingSeconds(now, now), 0);
  assert.equal(jlpt.remainingSeconds(now - 3000, now), 0); // Math.max(0, ...)

  console.log('--- Testing jlptData.ts ---');
  const jlptData = loadModule('src/lib/jlptData.ts');

  // Verify InputError export
  assert.ok(jlptData.JlptInputError, 'JlptInputError must be exported');

  // Test catalog
  const catalog = jlptData.getJlptCatalog();
  assert.equal(catalog.exams.length, 10, 'Catalog must contain 10 exams');
  assert.equal(catalog.durationMinutes, 105, 'Catalog duration must be 105 minutes');
  assert.equal(catalog.totalQuestions, 750, 'Catalog total questions must be 750');

  for (let i = 0; i < 10; i++) {
    const exam = catalog.exams[i];
    assert.equal(exam.number, i + 1);
    assert.equal(exam.questionCount, 75, `Exam ${exam.number} must have 75 questions`);
    assert.equal(exam.parts.length, 3, `Exam ${exam.number} must have 3 parts`);
    assert.equal(exam.parts[0].category, 'vocabulary_kanji');
    assert.equal(exam.parts[0].label, 'Từ vựng / Kanji');
    assert.equal(exam.parts[0].questionCount, 32);
    assert.equal(exam.parts[1].category, 'grammar');
    assert.equal(exam.parts[1].label, 'Ngữ pháp');
    assert.equal(exam.parts[1].questionCount, 22);
    assert.equal(exam.parts[2].category, 'reading');
    assert.equal(exam.parts[2].label, 'Đọc hiểu');
    assert.equal(exam.parts[2].questionCount, 21);
  }

  // Test all 10 mock papers and keys leak guard
  let totalMockQuestions = 0;
  for (let examNum = 1; examNum <= 10; examNum++) {
    const mockPaper = jlptData.getJlptPaper('mock', examNum);
    assert.equal(mockPaper.number, examNum);
    assert.equal(mockPaper.mode, 'mock');
    assert.equal(mockPaper.durationMinutes, catalog.durationMinutes);
    assert.equal(mockPaper.questions.length, 75);
    totalMockQuestions += mockPaper.questions.length;

    // Check key leak guard
    for (const q of mockPaper.questions) {
      assert.equal(q.answer, undefined, `Answer must not leak in question ${q.id}`);
      assert.equal(q.full_order, undefined, `full_order must not leak in question ${q.id}`);
      assert.equal(q.completed_sentence, undefined, `completed_sentence must not leak in question ${q.id}`);
      assert.equal(q.explanation, undefined, `explanation must not leak in question ${q.id}`);

      // Choices check
      assert.equal(q.choices.length, 4, `Question ${q.id} must have 4 choices`);
      for (const choice of q.choices) {
        assert.ok([1, 2, 3, 4].includes(choice.id));
        assert.ok(choice.text && choice.text.length > 0);
      }

      // Passage check
      if (q.passage_id) {
        assert.ok(q.passage, `Question ${q.id} references passage_id ${q.passage_id} but passage is missing`);
        assert.equal(q.passage.id, q.passage_id);
        const hasText = typeof q.passage.text === 'string' && q.passage.text.length > 0;
        const hasTexts = Array.isArray(q.passage.texts) && q.passage.texts.length > 0;
        assert.ok(hasText || hasTexts, `Passage ${q.passage_id} must have text or texts`);
      }

      // Star question check
      if (q.format === 'sentence_order_star') {
        assert.ok(
          typeof q.star_blank_index === 'number' && q.star_blank_index >= 1 && q.star_blank_index <= 4,
          `Star question ${q.id} must have valid star_blank_index`
        );
      }
    }
  }
  assert.equal(totalMockQuestions, 750);

  // Test 30 practice parts (32, 22, 21 questions)
  for (let examNum = 1; examNum <= 10; examNum++) {
    const vocabPart = jlptData.getJlptPaper('practice', examNum, 'vocabulary_kanji');
    assert.equal(vocabPart.questions.length, 32);
    assert.equal(vocabPart.durationMinutes, null);
    assert.equal(vocabPart.title, `Đề ${examNum} – Từ vựng / Kanji`);

    const grammarPart = jlptData.getJlptPaper('practice', examNum, 'grammar');
    assert.equal(grammarPart.questions.length, 22);

    const readingPart = jlptData.getJlptPaper('practice', examNum, 'reading');
    assert.equal(readingPart.questions.length, 21);
  }

  // Regression: Grade all 10 mock exams against independent key JSON
  for (let examNum = 1; examNum <= 10; examNum++) {
    const paper = jlptData.getJlptPaper('mock', examNum);
    const perfectAnswers = {};
    for (const q of paper.questions) {
      const expectedItem = independentKeyMap.get(q.id);
      assert.ok(expectedItem, `Question ${q.id} must exist in independent key map`);
      perfectAnswers[q.id] = expectedItem.answer;
    }

    const grade = jlptData.gradeJlptSubmission('mock', examNum, undefined, perfectAnswers);
    assert.equal(grade.total, 75);
    assert.equal(grade.correct, 75, `Exam ${examNum} perfect submission must have 75 correct`);
    assert.equal(grade.incorrect, 0);
    assert.equal(grade.unanswered, 0);
    assert.equal(grade.sections[0].correct, 32);
    assert.equal(grade.sections[0].total, 32);
    assert.equal(grade.sections[1].correct, 22);
    assert.equal(grade.sections[1].total, 22);
    assert.equal(grade.sections[2].correct, 21);
    assert.equal(grade.sections[2].total, 21);
  }

  // Test grading: partial answers
  const paper1 = jlptData.getJlptPaper('mock', 1);
  const q1 = paper1.questions[0];
  const q2 = paper1.questions[1];
  const q1Correct = independentKeyMap.get(q1.id).answer;
  const q2Correct = independentKeyMap.get(q2.id).answer;
  const q2Wrong = q2Correct === 1 ? 2 : 1;

  const partialGrade = jlptData.gradeJlptSubmission('mock', 1, undefined, {
    [q1.id]: q1Correct,
    [q2.id]: q2Wrong,
  });
  assert.equal(partialGrade.total, 75);
  assert.equal(partialGrade.correct, 1);
  assert.equal(partialGrade.incorrect, 1);
  assert.equal(partialGrade.unanswered, 73);

  // Test star question answer details
  const baselineGrade = jlptData.gradeJlptSubmission('mock', 1, undefined, {});
  let foundStarAnswer = false;
  for (const [qid, detail] of Object.entries(baselineGrade.answers)) {
    if (detail.full_order) {
      foundStarAnswer = true;
      assert.equal(detail.full_order.length, 4);
      assert.ok(typeof detail.completed_sentence === 'string' && detail.completed_sentence.length > 0);
    }
  }
  assert.ok(foundStarAnswer, 'Star questions must contain full_order and completed_sentence in answers');

  // Test typed JlptInputError on foreign ID and invalid choice
  assert.throws(
    () => jlptData.gradeJlptSubmission('mock', 1, undefined, { 'FOREIGN-Q99': 1 }),
    jlptData.JlptInputError
  );
  assert.throws(
    () => jlptData.gradeJlptSubmission('mock', 1, undefined, { [q1.id]: 5 }),
    jlptData.JlptInputError
  );

  console.log('--- Testing route.ts ---');
  const route = loadModule('src/app/api/jlpt/route.ts');
  const { NextRequest } = mockNextServer;

  // GET no params -> catalog
  const getCatalogReq = new NextRequest('http://localhost:3000/api/jlpt');
  const catalogRes = await route.GET(getCatalogReq);
  assert.equal(catalogRes.status, 200);
  assert.equal(catalogRes.data.totalQuestions, 750);
  assert.equal(catalogRes.data.exams[0].parts[0].label, 'Từ vựng / Kanji');

  // GET mock exam 1 -> paper 75 questions
  const getMockReq = new NextRequest('http://localhost:3000/api/jlpt?mode=mock&exam=1');
  const mockRes = await route.GET(getMockReq);
  assert.equal(mockRes.status, 200);
  assert.equal(mockRes.data.questions.length, 75);
  assert.equal(mockRes.data.durationMinutes, 105);
  assert.equal(mockRes.data.questions[0].answer, undefined);

  // GET practice exam 1 category grammar -> 22 questions
  const getPracticeReq = new NextRequest('http://localhost:3000/api/jlpt?mode=practice&exam=1&category=grammar');
  const practiceRes = await route.GET(getPracticeReq);
  assert.equal(practiceRes.status, 200);
  assert.equal(practiceRes.data.questions.length, 22);

  // GET invalid mode -> 400
  const getBadModeReq = new NextRequest('http://localhost:3000/api/jlpt?mode=unknown&exam=1');
  const badModeRes = await route.GET(getBadModeReq);
  assert.equal(badModeRes.status, 400);

  // GET invalid exam numbers -> 400
  for (const badExam of ['0', '11', '-1', 'abc', '1.5']) {
    const res = await route.GET(new NextRequest(`http://localhost:3000/api/jlpt?mode=mock&exam=${badExam}`));
    assert.equal(res.status, 400, `Exam ${badExam} must return 400`);
  }

  // GET practice without category -> 400
  const getMissingCatReq = new NextRequest('http://localhost:3000/api/jlpt?mode=practice&exam=1');
  const missingCatRes = await route.GET(getMissingCatReq);
  assert.equal(missingCatRes.status, 400);

  // GET practice with foreign category -> 400
  const getBadCatReq = new NextRequest('http://localhost:3000/api/jlpt?mode=practice&exam=1&category=listening');
  const badCatRes = await route.GET(getBadCatReq);
  assert.equal(badCatRes.status, 400);

  // POST valid submission
  const postValidReq = new NextRequest('http://localhost:3000/api/jlpt', {
    body: JSON.stringify({
      mode: 'mock',
      exam: 1,
      answers: { [q1.id]: q1Correct },
    }),
  });
  const postValidRes = await route.POST(postValidReq);
  assert.equal(postValidRes.status, 200);
  assert.equal(postValidRes.data.correct, 1);
  assert.equal(postValidRes.data.unanswered, 74);

  // POST invalid shapes -> 400
  const invalidShapes = [
    '[]', // array
    'null', // null
    '123', // number
    '"string"', // string
    JSON.stringify({ mode: 'mock', exam: '1', answers: {} }), // string exam
    JSON.stringify({ mode: 'mock', exam: 1, answers: [] }), // array answers
    JSON.stringify({ mode: 'invalid_mode', exam: 1, answers: {} }), // foreign mode
    JSON.stringify({ mode: 'practice', exam: 1, category: 'foreign_cat', answers: {} }), // foreign category
    JSON.stringify({ mode: 'mock', exam: 1, answers: { [q1.id]: '1' } }), // string choice
    JSON.stringify({ mode: 'mock', exam: 1, answers: { [q1.id]: null } }), // null choice
  ];
  for (const badShape of invalidShapes) {
    const res = await route.POST(new NextRequest('http://localhost:3000/api/jlpt', { body: badShape }));
    assert.equal(res.status, 400, `Shape ${badShape} must return 400`);
  }

  // POST __proto__ key -> rejected with 400
  const postProtoReq = new NextRequest('http://localhost:3000/api/jlpt', {
    body: '{"mode":"mock","exam":1,"answers":{"__proto__":1}}',
  });
  const postProtoRes = await route.POST(postProtoReq);
  assert.equal(postProtoRes.status, 400, '__proto__ key must be rejected as foreign ID');

  // POST foreign question ID -> 400
  const postForeignReq = new NextRequest('http://localhost:3000/api/jlpt', {
    body: JSON.stringify({
      mode: 'mock',
      exam: 1,
      answers: { 'INVALID-ID': 1 },
    }),
  });
  const postForeignRes = await route.POST(postForeignReq);
  assert.equal(postForeignRes.status, 400);

  // POST invalid choice number -> 400
  const postBadChoiceReq = new NextRequest('http://localhost:3000/api/jlpt', {
    body: JSON.stringify({
      mode: 'mock',
      exam: 1,
      answers: { [q1.id]: 9 },
    }),
  });
  const postBadChoiceRes = await route.POST(postBadChoiceReq);
  assert.equal(postBadChoiceRes.status, 400);

  // POST payload too large (>20KB) -> 413
  const hugePayload = 'x'.repeat(21000);
  const postHugeReq = new NextRequest('http://localhost:3000/api/jlpt', {
    headers: { 'content-length': String(Buffer.byteLength(hugePayload, 'utf8')) },
    body: hugePayload,
  });
  const postHugeRes = await route.POST(postHugeReq);
  assert.equal(postHugeRes.status, 413);

  // POST malformed JSON -> 400
  const postMalformedReq = new NextRequest('http://localhost:3000/api/jlpt', {
    body: '{ invalid json',
  });
  const postMalformedRes = await route.POST(postMalformedReq);
  assert.equal(postMalformedRes.status, 400);

  // 503 data failure simulation without touching real files
  console.log('--- Testing 503 Data Failure Recovery ---');
  const mockedFs = {
    ...fs,
    existsSync: (target) => {
      if (typeof target === 'string' && target.includes('n2-exams.json')) return false;
      return fs.existsSync(target);
    },
  };
  const failingJlptData = loadModule('src/lib/jlptData.ts', { 'node:fs': mockedFs, fs: mockedFs });
  const failingRoute = loadModule('src/app/api/jlpt/route.ts', {
    '@/lib/jlptData': failingJlptData,
  });

  // GET with missing file -> 503 and generic Vietnamese error (no leaked paths)
  const failGetRes = await failingRoute.GET(new NextRequest('http://localhost:3000/api/jlpt'));
  assert.equal(failGetRes.status, 503);
  assert.equal(
    failGetRes.data.error,
    'Dữ liệu đề thi tạm thời không khả dụng, vui lòng thử lại sau.'
  );
  assert.ok(!JSON.stringify(failGetRes.data).includes('data'), '503 must not leak filesystem paths');

  // POST with missing file -> 503 and generic Vietnamese error
  const failPostRes = await failingRoute.POST(
    new NextRequest('http://localhost:3000/api/jlpt', {
      body: JSON.stringify({ mode: 'mock', exam: 1, answers: {} }),
    })
  );
  assert.equal(failPostRes.status, 503);
  assert.equal(
    failPostRes.data.error,
    'Dữ liệu đề thi tạm thời không khả dụng, vui lòng thử lại sau.'
  );

  console.log('ALL JLPT CHECKS PASSED');
}

runTests().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});

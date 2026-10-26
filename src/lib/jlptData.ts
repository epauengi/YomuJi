import fs from 'node:fs';
import path from 'node:path';
import {
  CATEGORIES,
  type Category,
  type Mode,
  type PaperQuestion,
  type Paper,
  type Catalog,
  type Grade,
  type GradeSection,
  type AnswerDetail,
  type PaperQuestionPassage,
} from './jlpt';

export class JlptInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JlptInputError';
  }
}

interface RawChoice {
  id: number;
  text: string;
}

interface RawPassageText {
  label: string;
  text: string;
}

interface RawPassage {
  id: string;
  genre?: string;
  text?: string;
  texts?: RawPassageText[];
}

interface RawQuestion {
  id: string;
  format: string;
  question: string;
  choices: RawChoice[];
  focus?: string;
  answer_rule?: string;
  passage_id?: string;
  blank_number?: number;
  star_blank_index?: number;
}

interface RawProblem {
  problem_number: number;
  subtype: string;
  instruction: string;
  questions: RawQuestion[];
  passages?: RawPassage[];
}

interface RawPart {
  id: string;
  category: Category;
  level: string;
  total_questions: number;
  problems: RawProblem[];
}

interface RawAnswerItem {
  id: string;
  answer: number;
  full_order?: number[];
  completed_sentence?: string;
}

interface RawExamsFile {
  metadata: {
    title: string;
    level: string;
    total_exams: number;
    total_questions: number;
    n2_joint_time_minutes?: number;
  };
  exam_groups: Record<Category, RawPart[]>;
}

interface RawAnswerKeyFile {
  metadata?: Record<string, unknown>;
  answer_keys: Record<string, RawAnswerItem[]>;
}

interface LoadedData {
  catalog: Catalog;
  partsMap: Map<string, RawPart>;
  answersMap: Map<string, RawAnswerItem>;
}

let cached: LoadedData | null = null;

const CATEGORY_LABEL_MAP: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label])
) as Record<Category, string>;

const EXPECTED_COUNTS: Record<Category, number> = {
  vocabulary_kanji: 32,
  grammar: 22,
  reading: 21,
};

function loadData(): LoadedData {
  if (cached) return cached;

  const examsPath = path.join(process.cwd(), 'data', 'jlpt', 'n2-exams.json');
  const answerKeyPath = path.join(process.cwd(), 'data', 'jlpt', 'n2-answer-key.json');

  if (!fs.existsSync(examsPath)) {
    throw new Error('Dữ liệu đề thi không tồn tại');
  }
  if (!fs.existsSync(answerKeyPath)) {
    throw new Error('Dữ liệu đáp án không tồn tại');
  }

  const examsRaw = fs.readFileSync(examsPath, 'utf8');
  const examsData: RawExamsFile = JSON.parse(examsRaw);

  const keyRaw = fs.readFileSync(answerKeyPath, 'utf8');
  const keyParsed: RawAnswerKeyFile = JSON.parse(keyRaw);

  const answersMap = new Map<string, RawAnswerItem>();
  const seenAnswerIds = new Set<string>();

  if (!keyParsed.answer_keys || typeof keyParsed.answer_keys !== 'object') {
    throw new Error('Cấu trúc tệp đáp án không hợp lệ');
  }

  for (const [partId, items] of Object.entries(keyParsed.answer_keys)) {
    if (!Array.isArray(items)) {
      throw new Error(`Dữ liệu đáp án phần ${partId} không hợp lệ`);
    }
    for (const item of items) {
      if (!item.id || typeof item.id !== 'string') {
        throw new Error(`Mã câu hỏi đáp án thiếu hoặc không hợp lệ ở phần ${partId}`);
      }
      if (seenAnswerIds.has(item.id)) {
        throw new Error(`Trùng lặp mã đáp án: ${item.id}`);
      }
      if (![1, 2, 3, 4].includes(item.answer)) {
        throw new Error(`Giá trị đáp án không hợp lệ cho câu ${item.id}: ${item.answer}`);
      }
      seenAnswerIds.add(item.id);
      answersMap.set(item.id, item);
    }
  }

  if (seenAnswerIds.size !== 750) {
    throw new Error(`Số lượng đáp án không khớp: kỳ vọng 750, thực tế ${seenAnswerIds.size}`);
  }

  const partsMap = new Map<string, RawPart>();
  const seenQuestionIds = new Set<string>();
  const exams = [];
  const durationMinutes = examsData.metadata?.n2_joint_time_minutes ?? 105;

  if (!examsData.exam_groups || typeof examsData.exam_groups !== 'object') {
    throw new Error('Cấu trúc đề thi không hợp lệ');
  }

  for (let examNum = 1; examNum <= 10; examNum++) {
    const suffix = String(examNum).padStart(2, '0');
    const examParts: { category: Category; label: string; questionCount: number }[] = [];
    let examQuestionCount = 0;

    for (const cat of CATEGORIES) {
      const parts = examsData.exam_groups[cat.id];
      if (!Array.isArray(parts)) {
        throw new Error(`Thiếu nhóm đề cho danh mục ${cat.id}`);
      }

      const part = parts.find((p) => p.id.endsWith(`-${suffix}`));
      if (!part) {
        throw new Error(`Thiếu phần thi ${cat.id} cho đề ${examNum}`);
      }
      partsMap.set(part.id, part);

      const partPassageIds = new Set<string>();
      if (Array.isArray(part.problems)) {
        for (const prob of part.problems) {
          if (Array.isArray(prob.passages)) {
            for (const pass of prob.passages) {
              if (!pass.id) throw new Error(`Đoạn văn thiếu id ở phần ${part.id}`);
              const hasText = typeof pass.text === 'string' && pass.text.trim().length > 0;
              const hasTexts = Array.isArray(pass.texts) && pass.texts.length > 0 && pass.texts.every((t) => t.text && t.text.trim().length > 0);
              if (!hasText && !hasTexts) {
                throw new Error(`Đoạn văn ${pass.id} không có nội dung hợp lệ`);
              }
              partPassageIds.add(pass.id);
            }
          }
        }
      }

      let qCount = 0;
      for (const prob of part.problems) {
        for (const q of prob.questions) {
          if (seenQuestionIds.has(q.id)) {
            throw new Error(`Trùng lặp mã câu hỏi: ${q.id}`);
          }
          seenQuestionIds.add(q.id);

          if (!answersMap.has(q.id)) {
            throw new Error(`Câu hỏi ${q.id} không có đáp án tương ứng`);
          }

          if (!Array.isArray(q.choices) || q.choices.length !== 4) {
            throw new Error(`Câu hỏi ${q.id} phải có đúng 4 lựa chọn`);
          }

          const choiceIds = new Set(q.choices.map((c) => c.id));
          if (choiceIds.size !== 4 || ![1, 2, 3, 4].every((id) => choiceIds.has(id))) {
            throw new Error(`Lựa chọn của câu hỏi ${q.id} phải có đầy đủ id từ 1 đến 4`);
          }

          for (const c of q.choices) {
            if (!c.text || c.text.trim().length === 0) {
              throw new Error(`Nội dung lựa chọn trống ở câu hỏi ${q.id}`);
            }
          }

          if (q.passage_id && !partPassageIds.has(q.passage_id)) {
            throw new Error(`Câu hỏi ${q.id} tham chiếu đoạn văn không tồn tại: ${q.passage_id}`);
          }

          if (q.format === 'sentence_order_star') {
            if (typeof q.star_blank_index !== 'number' || q.star_blank_index < 1 || q.star_blank_index > 4) {
              throw new Error(`Câu hỏi dấu sao ${q.id} thiếu star_blank_index hợp lệ`);
            }
            const ans = answersMap.get(q.id)!;
            if (!Array.isArray(ans.full_order) || ans.full_order.length !== 4 || !ans.completed_sentence) {
              throw new Error(`Đáp án câu hỏi dấu sao ${q.id} thiếu full_order hoặc completed_sentence`);
            }
          }

          qCount++;
        }
      }

      const expected = EXPECTED_COUNTS[cat.id];
      if (qCount !== expected) {
        throw new Error(`Số lượng câu hỏi phần ${part.id} không khớp: kỳ vọng ${expected}, thực tế ${qCount}`);
      }

      examQuestionCount += qCount;
      examParts.push({
        category: cat.id,
        label: cat.label,
        questionCount: qCount,
      });
    }

    if (examQuestionCount !== 75) {
      throw new Error(`Tổng số câu hỏi đề thi thử số ${examNum} không khớp: kỳ vọng 75, thực tế ${examQuestionCount}`);
    }

    exams.push({
      number: examNum,
      questionCount: examQuestionCount,
      parts: examParts,
    });
  }

  if (seenQuestionIds.size !== 750) {
    throw new Error(`Tổng số câu hỏi toàn bộ không khớp 750: thực tế ${seenQuestionIds.size}`);
  }

  const catalog: Catalog = {
    exams,
    durationMinutes,
    totalQuestions: exams.reduce((sum, e) => sum + e.questionCount, 0),
  };

  cached = { catalog, partsMap, answersMap };
  return cached;
}

function buildPaperQuestions(part: RawPart): PaperQuestion[] {
  const passageMap = new Map<string, RawPassage>();
  for (const problem of part.problems) {
    if (problem.passages) {
      for (const p of problem.passages) {
        passageMap.set(p.id, p);
      }
    }
  }

  const result: PaperQuestion[] = [];
  const catLabel = CATEGORY_LABEL_MAP[part.category] || part.category;

  for (const problem of part.problems) {
    for (const q of problem.questions) {
      let passage: PaperQuestionPassage | undefined;
      if (q.passage_id && passageMap.has(q.passage_id)) {
        const rawP = passageMap.get(q.passage_id)!;
        passage = {
          id: rawP.id,
          text: rawP.text,
          texts: rawP.texts,
        };
      }

      result.push({
        id: q.id,
        format: q.format,
        question: q.question,
        choices: q.choices.map((c) => ({ id: c.id, text: c.text })),
        focus: q.focus,
        answer_rule: q.answer_rule,
        passage_id: q.passage_id,
        blank_number: q.blank_number,
        star_blank_index: q.star_blank_index,
        category: part.category,
        categoryLabel: catLabel,
        problemNumber: problem.problem_number,
        subtype: problem.subtype,
        instruction: problem.instruction,
        passage,
      });
    }
  }

  return result;
}

export function getJlptCatalog(): Catalog {
  return loadData().catalog;
}

export function getJlptPaper(mode: Mode, examNumber: number, category?: Category): Paper {
  if (typeof examNumber !== 'number' || !Number.isInteger(examNumber) || examNumber < 1 || examNumber > 10) {
    throw new JlptInputError(`Số đề không hợp lệ: ${examNumber}`);
  }

  const { partsMap, catalog } = loadData();
  const suffix = String(examNumber).padStart(2, '0');

  if (mode === 'practice') {
    if (!category || !CATEGORY_LABEL_MAP[category]) {
      throw new JlptInputError('Chế độ luyện tập yêu cầu chỉ định phần thi hợp lệ');
    }
    const catPrefix = category === 'vocabulary_kanji' ? 'N2-VOCAB' : category === 'grammar' ? 'N2-GRAMMAR' : 'N2-READING';
    const partId = `${catPrefix}-${suffix}`;
    const part = partsMap.get(partId);
    if (!part) {
      throw new JlptInputError(`Không tìm thấy đề ${examNumber} phần ${category}`);
    }
    const questions = buildPaperQuestions(part);
    return {
      title: `Đề ${examNumber} – ${CATEGORY_LABEL_MAP[category]}`,
      number: examNumber,
      mode: 'practice',
      durationMinutes: null,
      questions,
    };
  }

  if (mode !== 'mock') {
    throw new JlptInputError(`Chế độ không hợp lệ: ${mode}`);
  }

  const questions: PaperQuestion[] = [];
  for (const cat of CATEGORIES) {
    const catPrefix = cat.id === 'vocabulary_kanji' ? 'N2-VOCAB' : cat.id === 'grammar' ? 'N2-GRAMMAR' : 'N2-READING';
    const partId = `${catPrefix}-${suffix}`;
    const part = partsMap.get(partId);
    if (!part) {
      throw new JlptInputError(`Không tìm thấy đề thi thử số ${examNumber}`);
    }
    questions.push(...buildPaperQuestions(part));
  }

  return {
    title: `Đề thi thử N2 số ${examNumber}`,
    number: examNumber,
    mode: 'mock',
    durationMinutes: catalog.durationMinutes,
    questions,
  };
}

export function gradeJlptSubmission(
  mode: Mode,
  examNumber: number,
  category: Category | undefined,
  answers: Record<string, number>
): Grade {
  const { answersMap } = loadData();
  const paper = getJlptPaper(mode, examNumber, category);
  const validQuestionIds = new Set(paper.questions.map((q) => q.id));

  // Whitelist question IDs: reject if foreign IDs present (including __proto__)
  for (const qid of Object.keys(answers)) {
    if (!validQuestionIds.has(qid)) {
      throw new JlptInputError(`Mã câu hỏi không thuộc đề thi: ${qid}`);
    }
  }

  // Whitelist choices: each choice must be 1..4
  for (const [qid, choice] of Object.entries(answers)) {
    if (![1, 2, 3, 4].includes(choice)) {
      throw new JlptInputError(`Lựa chọn không hợp lệ cho câu ${qid}: ${choice}`);
    }
  }

  const sectionMap = new Map<Category, { category: Category; label: string; correct: number; total: number }>();
  const returnAnswers: Record<string, AnswerDetail> = {};
  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalUnanswered = 0;

  for (const q of paper.questions) {
    if (!sectionMap.has(q.category)) {
      sectionMap.set(q.category, {
        category: q.category,
        label: q.categoryLabel,
        correct: 0,
        total: 0,
      });
    }
    const sec = sectionMap.get(q.category)!;
    sec.total += 1;

    const key = answersMap.get(q.id);
    if (!key) {
      throw new Error(`Thiếu đáp án cho câu ${q.id}`);
    }

    returnAnswers[q.id] = {
      answer: key.answer,
      full_order: key.full_order,
      completed_sentence: key.completed_sentence,
    };

    const userChoice = answers[q.id];
    if (userChoice === undefined) {
      totalUnanswered += 1;
    } else if (userChoice === key.answer) {
      totalCorrect += 1;
      sec.correct += 1;
    } else {
      totalIncorrect += 1;
    }
  }

  const sections: GradeSection[] = Array.from(sectionMap.values());

  return {
    correct: totalCorrect,
    incorrect: totalIncorrect,
    unanswered: totalUnanswered,
    total: paper.questions.length,
    sections,
    answers: returnAnswers,
  };
}

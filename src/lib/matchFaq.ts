import { faqs, type FaqLink } from "@/src/data/faqs";

const NO_MATCH_ANSWER =
  "Sorry, I could not find a matching FAQ answer. Please contact support for help.";
const MATCH_THRESHOLD = 3;

export type MatchFaqResult = {
  matchedFaqId: string | null;
  answer: string;
  links: FaqLink[];
  matchScore: number | null;
  status: "matched" | "no_match";
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized.length > 0 ? normalized.split(" ") : [];
}

function scoreFaq(normalizedQuestion: string, questionTokens: Set<string>, faq: (typeof faqs)[number]): number {
  const normalizedFaqQuestion = normalizeText(faq.question);

  if (!normalizedFaqQuestion) {
    return 0;
  }

  let score = 0;

  if (
    normalizedQuestion.includes(normalizedFaqQuestion) ||
    normalizedFaqQuestion.includes(normalizedQuestion)
  ) {
    score += 4;
  }

  for (const token of new Set(tokenize(faq.question))) {
    if (questionTokens.has(token)) {
      score += 1;
    }
  }

  for (const keyword of faq.keywords ?? []) {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) {
      continue;
    }

    if (normalizedQuestion.includes(normalizedKeyword)) {
      score += 2;
    }
  }

  return score;
}

export function matchFaq(question: string): MatchFaqResult {
  const normalizedQuestion = normalizeText(question);

  if (!normalizedQuestion || faqs.length === 0) {
    return {
      matchedFaqId: null,
      answer: NO_MATCH_ANSWER,
      links: [],
      matchScore: null,
      status: "no_match",
    };
  }

  const questionTokens = new Set(tokenize(normalizedQuestion));

  let bestFaq: (typeof faqs)[number] | null = null;
  let bestScore = 0;

  for (const faq of faqs) {
    const score = scoreFaq(normalizedQuestion, questionTokens, faq);
    if (score > bestScore) {
      bestScore = score;
      bestFaq = faq;
    }
  }

  if (!bestFaq || bestScore < MATCH_THRESHOLD) {
    return {
      matchedFaqId: null,
      answer: NO_MATCH_ANSWER,
      links: [],
      matchScore: null,
      status: "no_match",
    };
  }

  return {
    matchedFaqId: bestFaq.id,
    answer: bestFaq.answer,
    links: bestFaq.links ?? [],
    matchScore: bestScore,
    status: "matched",
  };
}

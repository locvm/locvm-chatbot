import { faqs, type FaqLink } from "@/src/data/faqs";

const NO_MATCH_ANSWER =
  "Sorry, I could not find a matching FAQ answer. Please contact support for help.";
const MATCH_THRESHOLD = 3;
const COMMON_WORD_REPLACEMENTS: Record<string, string> = {
  frree: "free",
  acount: "account",
  loging: "login",
  singin: "signin",
};
const BASIC_INTENT_RULES: Array<{ faqId: string; phrases: string[] }> = [
  {
    faqId: "reset-password-flow",
    phrases: [
      "reset password",
      "forgot password",
      "password reset",
      "forgot my password",
    ],
  },
  {
    faqId: "login-flow",
    phrases: [
      "log in",
      "login",
      "sign in",
      "signin",
      "cannot log in",
      "can t log in",
      "unable to log in",
      "cannot sign in",
      "can t sign in",
    ],
  },
  {
    faqId: "create-account-flow",
    phrases: [
      "sign up",
      "signup",
      "register",
      "create account",
      "make account",
      "new account",
    ],
  },
  {
    faqId: "is-app-free",
    phrases: ["is this free", "free", "pricing", "price", "cost", "fee", "fees", "how much"],
  },
  {
    faqId: "support-contact",
    phrases: [
      "contact support",
      "customer service",
      "help me",
      "need help",
      "talk to someone",
      "speak to someone",
      "support email",
    ],
  },
];

export type MatchFaqResult = {
  matchedFaqId: string | null;
  answer: string;
  links: FaqLink[];
  matchScore: number | null;
  status: "matched" | "no_match";
};

function normalizeText(input: string): string {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .map((word) => COMMON_WORD_REPLACEMENTS[word] ?? word)
    .join(" ");
}

function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized.length > 0 ? normalized.split(" ") : [];
}

function findFaqById(id: string): (typeof faqs)[number] | null {
  return faqs.find((faq) => faq.id === id) ?? null;
}

function containsAnyPhrase(haystack: string, phrases: string[]): boolean {
  return phrases.some((phrase) => {
    const normalizedPhrase = normalizeText(phrase);
    return normalizedPhrase.length > 0 && haystack.includes(normalizedPhrase);
  });
}

function matchBasicIntent(normalizedQuestion: string): (typeof faqs)[number] | null {
  for (const rule of BASIC_INTENT_RULES) {
    if (containsAnyPhrase(normalizedQuestion, rule.phrases)) {
      return findFaqById(rule.faqId);
    }
  }

  return null;
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

  for (const synonym of faq.synonyms ?? []) {
    const normalizedSynonym = normalizeText(synonym);
    if (!normalizedSynonym) {
      continue;
    }

    if (normalizedQuestion.includes(normalizedSynonym)) {
      score += 2;
    }

    for (const token of new Set(tokenize(normalizedSynonym))) {
      if (questionTokens.has(token)) {
        score += 1;
      }
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

  const basicIntentFaq = matchBasicIntent(normalizedQuestion);
  if (basicIntentFaq) {
    return {
      matchedFaqId: basicIntentFaq.id,
      answer: basicIntentFaq.answer,
      links: basicIntentFaq.links ?? [],
      matchScore: MATCH_THRESHOLD,
      status: "matched",
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

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
    faqId: "find-locum-coverage",
    phrases: [
      "find locum",
      "find locums",
      "find locum coverage",
      "find locum physician",
      "need locum coverage",
      "how do i find locums",
      "how can i find locums",
    ],
  },
  {
    faqId: "reset-password-flow",
    phrases: [
      "reset password",
      "forgot password",
      "password reset",
      "forgot my password",
      "reset my password",
      "trying to reset my password",
      "not receiving the email",
      "not receiving password",
      "not receiving the password",
      "password email",
      "reset email",
    ],
  },
  {
    faqId: "login-flow",
    phrases: [
      "log in",
      "login",
      "sign in",
      "signin",
      "logging in",
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
      "creating an account",
    ],
  },
  {
    faqId: "profile-setup-help",
    phrases: [
      "set up a profile",
      "setup a profile",
      "set up my profile",
      "setup my profile",
      "help me set up a profile",
      "help me set up my profile",
      "can you help me set up a profile",
      "help with my profile",
      "help me with my profile",
      "profile setup",
    ],
  },
  {
    faqId: "profile-details-help",
    phrases: [
      "filling in my details",
      "filling in profile details",
      "fill in my details",
      "fill in profile details",
      "profile details",
      "complete my details",
      "update my profile details",
    ],
  },
  {
    faqId: "upload-medical-license-receipt",
    phrases: [
      "upload cpso",
      "uploading cpso",
      "upload my cpso",
      "uploading my cpso",
      "upload license",
      "uploading license",
      "upload my license",
      "upload medical license",
      "uploading cpsl",
    ],
  },
  {
    faqId: "platform-fees",
    phrases: [
      "is this free",
      "is locvm free",
      "pricing",
      "price",
      "cost",
      "fee",
      "fees",
      "how much",
      "service fee",
      "platform fees",
      "matching fee",
      "match fee",
      "pay to use locvm",
      "fees after beta",
      "fees when you are no longer beta",
      "no longer beta",
      "website price",
      "website cost",
      "how much does locvm cost",
    ],
  },
  {
    faqId: "additional-payment-details",
    phrases: [
      "see additional details",
      "additional payment details",
      "payment details",
      "for payment details",
      "additional details for payment",
      "why does a posting say see additional details",
      "why does it say see additional details",
      "where are the additional payment details",
    ],
  },
  {
    faqId: "locum-cost-structure",
    phrases: [
      "what is locvm s cost structure",
      "what is locvms cost structure",
      "locum cost structure",
      "payment structure",
      "payment structure be like",
      "compensation structure",
      "pay structure",
      "how is the locum paid",
      "how is a locum paid",
      "how is compensation decided",
    ],
  },
  {
    faqId: "housing-info",
    phrases: [
      "housing",
      "what about housing",
      "accommodation",
      "accommodations",
      "lodging",
    ],
  },
  {
    faqId: "greeting",
    phrases: ["hi", "hello", "hey", "hi there"],
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
  {
    faqId: "what-is-locvm",
    phrases: [
      "what is this site about",
      "what is this website about",
      "what s the site about",
      "what is locvm about",
      "what does locvm do",
      "tell me about locvm",
      "site about",
      "about this site",
      "about this website",
    ],
  },
  {
    faqId: "what-is-cpso-receipt",
    phrases: [
      "what is a cpso receipt",
      "what is the cpso receipt",
      "what is cpso",
      "what does cpso receipt mean",
      "what does cpso mean",
      "cpso document",
      "cpso stand for",
    ],
  },
  {
    faqId: "get-cpso-receipt",
    phrases: [
      "cpso receipt",
      "where do i get my cpso receipt",
      "how do i get my cpso receipt",
      "get my cpso",
      "download cpso",
      "obtain cpso",
    ],
  },
  {
    faqId: "specialist-register",
    phrases: [
      "specialist looking for a locum",
      "looking for a locum to take over",
      "i need someone to cover my practice",
      "looking for locum coverage",
      "should i register as a specialist",
      "take over my practice",
      "cover my practice",
      "need locum for my practice",
    ],
  },
  {
    faqId: "team-behind-locvm",
    phrases: [
      "who is behind this",
      "who are the founders",
      "who created locvm",
      "who made locvm",
      "who runs locvm",
      "who is the team",
      "tell me about the team",
      "the team",
      "team behind locvm",
      "who built this",
    ],
  },
  {
    faqId: "earnings-estimate",
    phrases: [
      "how much can i make",
      "how much can i earn",
      "how much will i earn",
      "calculate earnings",
      "earnings calculator",
      "locum income",
      "how much do locums make",
      "how do i calculate how much i can make",
      "what will i earn",
      "locum earnings",
    ],
  },
  {
    faqId: "upload-cv",
    phrases: [
      "upload my cv",
      "upload cv",
      "upload my resume",
      "upload resume",
      "add my cv",
      "add my resume",
      "where do i add my cv",
      "where to add my cv",
      "can i add my resume",
      "curriculum vitae",
      "uploading cv",
      "uploading my cv",
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
  const haystackTokens = new Set(tokenize(haystack));

  return phrases.some((phrase) => {
    const normalizedPhrase = normalizeText(phrase);
    if (!normalizedPhrase) {
      return false;
    }

    const phraseTokens = tokenize(normalizedPhrase);
    if (phraseTokens.length === 1) {
      return haystackTokens.has(phraseTokens[0]);
    }

    return haystack.includes(normalizedPhrase);
  });
}

function matchBasicIntent(
  normalizedQuestion: string,
): (typeof faqs)[number] | null {
  for (const rule of BASIC_INTENT_RULES) {
    if (containsAnyPhrase(normalizedQuestion, rule.phrases)) {
      return findFaqById(rule.faqId);
    }
  }

  return null;
}

function scoreFaq(
  normalizedQuestion: string,
  questionTokens: Set<string>,
  faq: (typeof faqs)[number],
): number {
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

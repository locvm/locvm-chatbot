export type FAQ = {
  id: string;
  question: string;
  answer: string;
  keywords?: string[];
};

// TODO: Populate with real FAQ data in next phase
export const faqs: FAQ[] = [];

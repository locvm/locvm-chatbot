"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type FeedbackState =
  | "idle"
  | "submitting"
  | "submitted_yes"
  | "submitted_no"
  | "error";

type FeedbackFallbackLog = {
  userId: string;
  question: string;
  matchedFaqId: string | null;
  matchScore: number | null;
};

type AssistantFeedback = {
  interactionId: string | null;
  fallbackLog: FeedbackFallbackLog;
  state: FeedbackState;
};

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  feedback?: AssistantFeedback;
  noMatchSuggestions?: string[];
  supportEmail?: string;
};

type FaqApiResponse = {
  interactionId?: string;
  answer?: string;
  matchedFaqId?: string | null;
  matchScore?: number | null;
  status?: "matched" | "no_match";
  logSaved?: boolean;
  logError?: string | null;
  retryAfterSeconds?: number;
  error?: string;
};

type FeedbackApiResponse = {
  interactionId?: string;
  helpful?: boolean;
  ok?: boolean;
  error?: string;
};

const HUMAN_HELP_MESSAGE =
  "I'm sorry this has been frustrating. We're happy to help you in person. Please contact support@locvm.ca and our team will follow up.";

const starterMessage: Message = {
  id: "start",
  role: "assistant",
  text: "Hi, I'm the LOCVM automated assistant (not a live person). Ask me a question and I'll do my best to help. If you need direct help, email support@locvm.ca.",
};

function isFrustrationIntent(question: string): boolean {
  const normalized = question.trim().toLowerCase();
  const frustrationPhrases = [
    "not working",
    "isn't working",
    "doesn't work",
    "does not work",
    "you are wrong",
    "you're wrong",
    "wrong",
    "i don't like",
    "this is frustrating",
    "i am frustrated",
    "frustrated",
    "this is useless",
    "bad answer",
  ];

  return frustrationPhrases.some((phrase) => normalized.includes(phrase));
}

function shouldShowNoMatchSuggestions(question: string): boolean {
  const normalized = question.trim().toLowerCase();
  const domainSignals = [
    "locvm",
    "locum",
    "opening",
    "job",
    "toronto",
    "support",
    "contact",
    "price",
    "cost",
    "fee",
    "payment",
    "paid",
    "jetpay",
    "password",
    "login",
    "log in",
    "sign in",
    "signin",
    "account",
    "verification",
    "onboarding",
    "booking",
    "posting",
    "recruiter",
    "physician",
    "cancellation",
    "cancel",
    "deposit",
  ];

  return !domainSignals.some((signal) => normalized.includes(signal));
}

function getFallbackReply(question: string): string {
  const normalized = question.trim().toLowerCase();

  if (
    normalized.includes("toronto") &&
    (normalized.includes("locum") ||
      normalized.includes("local") ||
      normalized.includes("job") ||
      normalized.includes("opening"))
  ) {
    return "For locum openings in Toronto, please go to the search page and browse opportunities in the list view or map view.";
  }

  if (normalized.includes("price") || normalized.includes("cost")) {
    return "LOCVM is free during beta, and fee logic is tied to confirmed matches rather than account creation or posting.";
  }

  if (
    normalized.includes("free") ||
    normalized.includes("fees") ||
    normalized.includes("pricing")
  ) {
    return "LOCVM is free during beta, and fee logic is tied to confirmed matches rather than account creation or posting.";
  }

  if (
    normalized.includes("login") ||
    normalized.includes("log in") ||
    normalized.includes("sign in") ||
    normalized.includes("signin")
  ) {
    return "Go to login, enter your email and password, then sign in. If you cannot access your account, use reset-password and follow the email link.";
  }

  if (
    normalized.includes("sign up") ||
    normalized.includes("signup") ||
    normalized.includes("register") ||
    normalized.includes("create account")
  ) {
    return "Use the sign-up flow, verify your email, then complete onboarding before applying to postings or creating them.";
  }

  if (normalized.includes("demo") || normalized.includes("tour")) {
    return "Absolutely. I can help you schedule a quick demo to walk through key features.";
  }

  if (
    normalized.includes("contact support") ||
    normalized.includes("customer service") ||
    normalized.includes("help me") ||
    normalized.includes("need help") ||
    normalized.includes("speak to someone") ||
    normalized.includes("talk to someone")
  ) {
    return "Support is available through our team contact form, and we usually respond quickly during business hours.";
  }

  if (
    normalized.includes("hello") ||
    normalized.includes("hi") ||
    normalized.includes("hey")
  ) {
    return "Hey there. Tell me what you're trying to do and I'll guide you. I'm an automated assistant, and you can always email support@locvm.ca for direct help.";
  }

  return "Thanks for your question. I'm an automated assistant, and if you need direct help please email support@locvm.ca.";
}

function getNoMatchGuidance(question: string): string {
  const normalized = question.trim().toLowerCase();

  if (
    normalized.includes("toronto") &&
    (normalized.includes("locum") ||
      normalized.includes("local") ||
      normalized.includes("job") ||
      normalized.includes("opening"))
  ) {
    return "For locum openings in Toronto, please go to the search page and browse opportunities in the list view or map view.";
  }

  if (
    normalized.includes("login") ||
    normalized.includes("log in") ||
    normalized.includes("sign in") ||
    normalized.includes("signin")
  ) {
    return "Try: 'How do I log in?' or 'How do I reset my password?'";
  }

  if (
    normalized.includes("free") ||
    normalized.includes("fees") ||
    normalized.includes("pricing") ||
    normalized.includes("price") ||
    normalized.includes("cost")
  ) {
    return "Try: 'Is this app free?' or 'Are there platform fees?'";
  }

  if (
    normalized.includes("sign up") ||
    normalized.includes("signup") ||
    normalized.includes("register") ||
    normalized.includes("create account")
  ) {
    return "Try: 'How do I create an account?' or 'Do I need to verify my email before onboarding?'";
  }

  if (
    normalized.includes("hello") ||
    normalized.includes("hi") ||
    normalized.includes("hey")
  ) {
    return "Hi there. You can ask me things like password reset, account access, pricing, support, and payments. For direct help, email support@locvm.ca.";
  }

  return "I couldn't find that exact answer yet. Try one of these common questions:";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getRateLimitReply(retryAfterSeconds?: number): string {
  if (typeof retryAfterSeconds === "number" && retryAfterSeconds > 0) {
    return `You are sending messages too quickly. Please wait about ${retryAfterSeconds} seconds and try again.`;
  }

  return "You are sending messages too quickly. Please wait a moment and try again.";
}

async function logQuestionBestEffort(userId: string, question: string): Promise<void> {
  try {
    await fetch("/api/faq", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId,
        question,
      }),
    });
  } catch {
    // Ignore logging failures here to keep handoff response fast and stable.
  }
}

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([starterMessage]);
  const [pendingReplies, setPendingReplies] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const sessionUserIdRef = useRef(`widget_${crypto.randomUUID().slice(0, 10)}`);

  const isTyping = pendingReplies > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const question = draft.trim();
    if (!question) {
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: question,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsOpen(true);
    setPendingReplies((current) => current + 1);

    if (isFrustrationIntent(question)) {
      void logQuestionBestEffort(sessionUserIdRef.current, question);
      await wait(700);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: HUMAN_HELP_MESSAGE,
        },
      ]);
      setPendingReplies((current) => Math.max(0, current - 1));
      return;
    }

    const startedAt = Date.now();

    let assistantMessage: Message;
    try {
      const response = await fetch("/api/faq", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: sessionUserIdRef.current,
          question,
        }),
      });

      const payload = (await response.json()) as FaqApiResponse;
      if (response.status === 429) {
        assistantMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: getRateLimitReply(payload.retryAfterSeconds),
        };
      } else if (!response.ok || typeof payload.answer !== "string") {
        throw new Error(payload.error ?? "faq_request_failed");
      } else {
        const feedbackContext: FeedbackFallbackLog = {
          userId: sessionUserIdRef.current,
          question,
          matchedFaqId:
            typeof payload.matchedFaqId === "string" && payload.matchedFaqId.length > 0
              ? payload.matchedFaqId
              : null,
          matchScore: typeof payload.matchScore === "number" ? payload.matchScore : null,
        };
        const interactionId =
          typeof payload.interactionId === "string" && payload.interactionId.length > 0
            ? payload.interactionId
            : null;
        if (payload.status === "no_match") {
          const showNoMatchSuggestions = shouldShowNoMatchSuggestions(question);
          assistantMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            text: showNoMatchSuggestions
              ? getNoMatchGuidance(question)
              : getFallbackReply(question),
            noMatchSuggestions: showNoMatchSuggestions
              ? [
                  "How do I reset my password?",
                  "How can I contact support?",
                  "Are there platform fees?",
                  "When do locum physicians get paid?",
                ]
              : undefined,
            supportEmail: showNoMatchSuggestions ? "support@locvm.ca" : undefined,
            feedback: {
              interactionId,
              fallbackLog: feedbackContext,
              state: "idle",
            },
          };
        } else {
          assistantMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            text: payload.answer,
            feedback: {
              interactionId,
              fallbackLog: feedbackContext,
              state: "idle",
            },
          };
        }
      }
    } catch {
      assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: getFallbackReply(question),
      };
    }

    const elapsed = Date.now() - startedAt;
    await wait(Math.max(0, 900 - elapsed));

    setMessages((current) => [...current, assistantMessage]);
    setPendingReplies((current) => Math.max(0, current - 1));
  };

  const submitFeedback = async (messageId: string, helpful: boolean) => {
    const message = messages.find((candidate) => candidate.id === messageId);
    if (!message?.feedback) {
      return;
    }

    if (
      message.feedback.state === "submitting" ||
      message.feedback.state === "submitted_yes" ||
      message.feedback.state === "submitted_no"
    ) {
      return;
    }

    const interactionId = message.feedback.interactionId;
    const fallbackLog = message.feedback.fallbackLog;

    setMessages((current) =>
      current.map((candidate) => {
        if (candidate.id !== messageId || !candidate.feedback) {
          return candidate;
        }

        return {
          ...candidate,
          feedback: {
            ...candidate.feedback,
            state: "submitting",
          },
        };
      })
    );

    try {
      const response = await fetch("/api/faq/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          interactionId: interactionId ?? undefined,
          helpful,
          fallbackLog,
        }),
      });

      const payload = (await response.json()) as FeedbackApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "feedback_request_failed");
      }

      setMessages((current) =>
        current.map((candidate) => {
          if (candidate.id !== messageId || !candidate.feedback) {
            return candidate;
          }

          return {
            ...candidate,
            feedback: {
              ...candidate.feedback,
              interactionId:
                typeof payload.interactionId === "string" && payload.interactionId.length > 0
                  ? payload.interactionId
                  : candidate.feedback.interactionId,
              state: helpful ? "submitted_yes" : "submitted_no",
            },
          };
        })
      );
    } catch {
      setMessages((current) =>
        current.map((candidate) => {
          if (candidate.id !== messageId || !candidate.feedback) {
            return candidate;
          }

          return {
            ...candidate,
            feedback: {
              ...candidate.feedback,
              state: "error",
            },
          };
        })
      );
    }
  };

  const latestFeedbackMessageId =
    [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.feedback)?.id ?? null;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>LOCVM Website Preview</p>
        <h1>Simple chatbot launcher at the bottom-right corner</h1>
        <p>
          This page is a prototype for the future embedded chat experience. Use
          the round button to open the widget and test a simple conversation.
        </p>
      </main>

      <section
        className={`${styles.widget} ${isOpen ? styles.widgetOpen : ""}`}
        aria-hidden={!isOpen}
      >
        <header className={styles.widgetHeader}>
          <div className={styles.headerCopy}>
            <p className={styles.widgetTitle}>Chat with us</p>
            <a className={styles.followUpLink} href="mailto:support@locvm.ca">
              <span className={styles.followUpIcon} aria-hidden>
                ↗
              </span>
              Need follow-up?
            </a>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Close chat"
            onClick={() => setIsOpen(false)}
          >
            ×
          </button>
        </header>

        <div className={styles.messages}>
          {messages.map((message) => (
            <article
              key={message.id}
              className={`${styles.message} ${
                message.role === "assistant"
                  ? styles.assistantMessage
                  : styles.userMessage
              }`}
            >
              <p>{message.text}</p>
              {message.noMatchSuggestions?.length ? (
                <>
                  <ul className={styles.suggestionList}>
                    {message.noMatchSuggestions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {message.supportEmail ? (
                    <p className={styles.suggestionSupport}>
                      For direct help, email{" "}
                      <a href={`mailto:${message.supportEmail}`}>{message.supportEmail}</a>.
                    </p>
                  ) : null}
                </>
              ) : null}
              {message.role === "assistant" &&
              message.feedback &&
              message.id === latestFeedbackMessageId ? (
                <div className={styles.feedbackRow}>
                  <p className={styles.feedbackPrompt}>Did this help?</p>
                  <div className={styles.feedbackActions}>
                    <button
                      type="button"
                      className={`${styles.feedbackButton} ${
                        message.feedback.state === "submitted_yes"
                          ? styles.feedbackButtonActive
                          : ""
                      }`}
                      onClick={() => submitFeedback(message.id, true)}
                      disabled={
                        message.feedback.state === "submitting" ||
                        message.feedback.state === "submitted_yes" ||
                        message.feedback.state === "submitted_no"
                      }
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`${styles.feedbackButton} ${
                        message.feedback.state === "submitted_no"
                          ? styles.feedbackButtonActive
                          : ""
                      }`}
                      onClick={() => submitFeedback(message.id, false)}
                      disabled={
                        message.feedback.state === "submitting" ||
                        message.feedback.state === "submitted_yes" ||
                        message.feedback.state === "submitted_no"
                      }
                    >
                      No
                    </button>
                  </div>
                  {message.feedback.state === "error" ? (
                    <p className={styles.feedbackError}>
                      Feedback could not be saved right now.
                    </p>
                  ) : null}
                  {message.feedback.state === "submitted_yes" ||
                  message.feedback.state === "submitted_no" ? (
                    <p className={styles.feedbackSaved}>Thanks for your feedback.</p>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
          {isTyping ? (
            <article className={`${styles.message} ${styles.assistantMessage}`}>
              <div
                className={styles.typingDots}
                aria-label="Assistant is typing"
                role="status"
              >
                <span />
                <span />
                <span />
              </div>
            </article>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <form className={styles.composer} onSubmit={onSubmit}>
          <div className={styles.composerRow}>
            <label htmlFor="chat-input" className={styles.srOnly}>
              Ask a question
            </label>
            <input
              id="chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type your question..."
              autoComplete="off"
            />
            <button type="submit">Send</button>
          </div>
        </form>
      </section>

      <button
        type="button"
        className={`${styles.launcher} ${isOpen ? styles.launcherOpen : ""}`}
        aria-label={isOpen ? "Close question assistant" : "Open question assistant"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? (
          <>
            <span className={styles.launcherIcon} aria-hidden>
              ×
            </span>
            <span>Close Assistant</span>
          </>
        ) : (
          <>
            <span className={styles.launcherIcon} aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 12.5v-7Z" />
              </svg>
            </span>
            <span>Questions? Ask Us</span>
          </>
        )}
      </button>
    </div>
  );
}

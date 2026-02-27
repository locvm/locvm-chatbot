"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import styles from "./ChatWidget.module.css";

export const DEFAULT_SUPPORT_EMAIL = "support@locvm.ca";
export const DEFAULT_LAUNCHER_LABEL = "Questions? Ask Us";
export const DEFAULT_WIDGET_TITLE = "Chat with us";

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
  retryAfterSeconds?: number;
  error?: string;
};

type FeedbackApiResponse = {
  interactionId?: string;
  error?: string;
};

export type ChatWidgetProps = {
  apiBaseUrl?: string;
  launcherLabel?: string;
  supportEmail?: string;
  widgetTitle?: string;
};

export function buildApiUrl(apiBaseUrl: string | undefined, path: string): string {
  const normalizedBase = (apiBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (!normalizedBase) {
    return path;
  }

  return `${normalizedBase}${path}`;
}

export function buildStarterMessage(supportEmail: string): string {
  return `Hi, I'm the LOCVM automated assistant (not a live person). Ask me a question and I'll do my best to help. If you need direct help, email ${supportEmail}.`;
}

export function buildHumanHelpMessage(supportEmail: string): string {
  return `I'm sorry this has been frustrating. We're happy to help you in person. Please contact ${supportEmail} and our team will follow up.`;
}

export function buildApiUnavailableMessage(supportEmail: string): string {
  return `I'm having trouble reaching the FAQ service right now. Please try again in a moment or email ${supportEmail} for direct help.`;
}

export function isFrustrationIntent(question: string): boolean {
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

export function getRateLimitReply(retryAfterSeconds?: number): string {
  if (typeof retryAfterSeconds === "number" && retryAfterSeconds > 0) {
    return `You are sending messages too quickly. Please wait about ${retryAfterSeconds} seconds and try again.`;
  }

  return "You are sending messages too quickly. Please wait a moment and try again.";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

async function postJson<TResponse>(url: string, body: unknown): Promise<{
  response: Response;
  payload: TResponse;
}> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as TResponse;
  return { response, payload };
}

export default function ChatWidget({
  apiBaseUrl,
  launcherLabel = DEFAULT_LAUNCHER_LABEL,
  supportEmail = DEFAULT_SUPPORT_EMAIL,
  widgetTitle = DEFAULT_WIDGET_TITLE,
}: ChatWidgetProps) {
  const inputId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "start",
      role: "assistant",
      text: buildStarterMessage(supportEmail),
    },
  ]);
  const [pendingReplies, setPendingReplies] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const sessionUserIdRef = useRef(`widget_${crypto.randomUUID().slice(0, 10)}`);

  const faqUrl = buildApiUrl(apiBaseUrl, "/api/faq");
  const feedbackUrl = buildApiUrl(apiBaseUrl, "/api/faq/feedback");
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
      try {
        await postJson<FaqApiResponse>(faqUrl, {
          userId: sessionUserIdRef.current,
          question,
        });
      } catch {
        // Ignore logging failures so the support handoff stays immediate.
      }

      await wait(700);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: buildHumanHelpMessage(supportEmail),
        },
      ]);
      setPendingReplies((current) => Math.max(0, current - 1));
      return;
    }

    const startedAt = Date.now();

    let assistantMessage: Message;
    try {
      const { response, payload } = await postJson<FaqApiResponse>(faqUrl, {
        userId: sessionUserIdRef.current,
        question,
      });

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
          assistantMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            text: payload.answer,
            noMatchSuggestions: [
              "How do I reset my password?",
              "How can I contact support?",
              "Are there platform fees?",
              "When do locum physicians get paid?",
            ],
            supportEmail,
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
        text: buildApiUnavailableMessage(supportEmail),
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
      const { response, payload } = await postJson<FeedbackApiResponse>(feedbackUrl, {
        interactionId: message.feedback.interactionId ?? undefined,
        helpful,
        fallbackLog: message.feedback.fallbackLog,
      });

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
    <div className={styles.widgetRoot}>
      <section
        className={`${styles.widget} ${isOpen ? styles.widgetOpen : ""}`}
        aria-hidden={!isOpen}
      >
        <header className={styles.widgetHeader}>
          <div className={styles.headerCopy}>
            <p className={styles.widgetTitle}>{widgetTitle}</p>
            <a className={styles.followUpLink} href={`mailto:${supportEmail}`}>
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
            <label htmlFor={inputId} className={styles.srOnly}>
              Ask a question
            </label>
            <input
              id={inputId}
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
            <span>{launcherLabel}</span>
          </>
        )}
      </button>
    </div>
  );
}

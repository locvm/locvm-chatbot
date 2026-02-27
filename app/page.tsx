"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type FeedbackState =
  | "idle"
  | "submitting"
  | "submitted_yes"
  | "submitted_no"
  | "error";

type AssistantFeedback = {
  interactionId: string;
  state: FeedbackState;
};

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  feedback?: AssistantFeedback;
};

type FaqApiResponse = {
  interactionId?: string;
  answer?: string;
  matchedFaqId?: string | null;
  matchScore?: number | null;
  status?: "matched" | "no_match";
  error?: string;
};

const starterMessage: Message = {
  id: "start",
  role: "assistant",
  text: "Hi, I'm the LOCVM assistant. Ask me anything and I'll point you in the right direction.",
};

function getFallbackReply(question: string): string {
  const normalized = question.trim().toLowerCase();

  if (normalized.includes("price") || normalized.includes("cost")) {
    return "Pricing depends on your team size and setup. I can connect you with sales for a fast quote.";
  }

  if (normalized.includes("demo") || normalized.includes("tour")) {
    return "Absolutely. I can help you schedule a quick demo to walk through key features.";
  }

  if (
    normalized.includes("help") ||
    normalized.includes("support") ||
    normalized.includes("contact")
  ) {
    return "Support is available through our team contact form, and we usually respond quickly during business hours.";
  }

  if (
    normalized.includes("hello") ||
    normalized.includes("hi") ||
    normalized.includes("hey")
  ) {
    return "Hey there. Tell me what you're trying to do and I'll guide you.";
  }

  return "Thanks for the question. This widget is in prototype mode, but this is where helpful answers will appear.";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
      if (!response.ok || typeof payload.answer !== "string") {
        throw new Error(payload.error ?? "faq_request_failed");
      }

      const answerText =
        payload.status === "no_match" ? getFallbackReply(question) : payload.answer;

      assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: answerText,
        feedback:
          typeof payload.interactionId === "string" && payload.interactionId.length > 0
            ? {
                interactionId: payload.interactionId,
                state: "idle",
              }
            : undefined,
      };
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
          interactionId,
          helpful,
        }),
      });

      if (!response.ok) {
        throw new Error("feedback_request_failed");
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
          <div>
            <p className={styles.widgetTitle}>Chat with us</p>
            <p className={styles.widgetSubtitle}>FAQ API connected</p>
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
              {message.role === "assistant" && message.feedback ? (
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
        </form>
      </section>

      <button
        type="button"
        className={`${styles.launcher} ${isOpen ? styles.launcherOpen : ""}`}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? "×" : "Chat"}
      </button>
    </div>
  );
}

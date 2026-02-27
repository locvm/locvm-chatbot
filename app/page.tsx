"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const starterMessage: Message = {
  id: "start",
  role: "assistant",
  text: "Hi, I'm the LOCVM assistant. Ask me anything and I'll point you in the right direction.",
};

function getAssistantReply(question: string): string {
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

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([starterMessage]);
  const [pendingReplies, setPendingReplies] = useState(0);
  const timeoutIds = useRef<number[]>([]);

  const isTyping = pendingReplies > 0;

  useEffect(() => {
    return () => {
      timeoutIds.current.forEach((id) => clearTimeout(id));
      timeoutIds.current = [];
    };
  }, []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
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

    const timeoutId = window.setTimeout(() => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: getAssistantReply(question),
      };

      setMessages((current) => [...current, assistantMessage]);
      setPendingReplies((current) => Math.max(0, current - 1));
      timeoutIds.current = timeoutIds.current.filter((id) => id !== timeoutId);
    }, 900);

    timeoutIds.current.push(timeoutId);
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
            <p className={styles.widgetSubtitle}>Prototype mode</p>
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

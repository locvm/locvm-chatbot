"use client";

import ChatWidget from "@/src/components/ChatWidget";

export default function Home() {
  return (
    <main style={{ padding: "2rem", maxWidth: 720 }}>
      <h1>LOCVM chatbot preview</h1>
      <p>Open the launcher in the bottom-right corner to test the widget.</p>
      <ChatWidget />
    </main>
  );
}

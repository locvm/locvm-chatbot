import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ChatWidget, {
  buildApiUnavailableMessage,
  buildApiUrl,
  buildHumanHelpMessage,
  buildStarterMessage,
  getRateLimitReply,
  isFrustrationIntent,
} from "@/src/components/ChatWidget";

describe("ChatWidget", () => {
  test("buildApiUrl keeps relative paths by default", () => {
    expect(buildApiUrl(undefined, "/api/faq")).toBe("/api/faq");
  });

  test("buildApiUrl joins hosted backend origin cleanly", () => {
    expect(buildApiUrl("https://chat.example.com/", "/api/faq")).toBe(
      "https://chat.example.com/api/faq"
    );
  });

  test("detects frustration intent phrases", () => {
    expect(isFrustrationIntent("This is not working for me")).toBe(true);
    expect(isFrustrationIntent("How do I reset my password?")).toBe(false);
  });

  test("builds messaging copy with the provided support email", () => {
    expect(buildStarterMessage("help@example.com")).toContain("help@example.com");
    expect(buildHumanHelpMessage("help@example.com")).toContain("help@example.com");
    expect(buildApiUnavailableMessage("help@example.com")).toContain("help@example.com");
  });

  test("returns a specific rate limit message when retryAfterSeconds is present", () => {
    expect(getRateLimitReply(12)).toContain("12 seconds");
    expect(getRateLimitReply()).toContain("wait a moment");
  });

  test("renders the standalone widget shell with custom labels", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ChatWidget, {
        launcherLabel: "Need Help?",
        supportEmail: "help@example.com",
        widgetTitle: "Support chat",
      })
    );

    expect(markup).toContain("Need Help?");
    expect(markup).toContain("Support chat");
    expect(markup).toContain("help@example.com");
    expect(markup).toContain("LOCVM automated assistant");
  });
});

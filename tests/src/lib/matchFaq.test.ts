import { matchFaq } from "@/src/lib/matchFaq";

describe("matchFaq", () => {
  test("matches canonical LOCVM question", () => {
    const result = matchFaq("What is LOCVM?");
    expect(result.status).toBe("matched");
    expect(result.matchedFaqId).toBe("what-is-locvm");
    expect(result.matchScore).toBeGreaterThanOrEqual(3);
  });

  test("normalizes whitespace, casing, and punctuation", () => {
    const result = matchFaq("   WHAT is    locvm?!  ");
    expect(result.status).toBe("matched");
    expect(result.matchedFaqId).toBe("what-is-locvm");
  });

  test("matches toronto locum intent with search link", () => {
    const result = matchFaq("I want a locum opening in Toronto");
    expect(result.status).toBe("matched");
    expect(result.matchedFaqId).toBe("find-locum-openings-in-toronto");
    expect(result.links.some((link) => link.href === "/search")).toBe(true);
  });

  test("matches direct login intent phrasing", () => {
    const result = matchFaq("i dont know how to log in");
    expect(result.status).toBe("matched");
    expect(result.matchedFaqId).toBe("login-flow");
  });

  test("matches exact login phrasing from widget transcript", () => {
    const result = matchFaq("how do i log in?");
    expect(result.status).toBe("matched");
    expect(result.matchedFaqId).toBe("login-flow");
  });

  test("matches find-locums phrasing", () => {
    const result = matchFaq("how do i find locums?");
    expect(result.status).toBe("matched");
    expect(result.matchedFaqId).toBe("find-locum-coverage");
  });

  test("matches app-free pricing phrasing with typo", () => {
    const result = matchFaq("is this app frree?");
    expect(result.status).toBe("matched");
    expect(result.matchedFaqId).toBe("is-app-free");
  });

  test("matches signup intent phrasing", () => {
    const result = matchFaq("how do i create an account");
    expect(result.status).toBe("matched");
    expect(result.matchedFaqId).toBe("create-account-flow");
  });

  test("matches support intent phrasing", () => {
    const result = matchFaq("i need help from customer service");
    expect(result.status).toBe("matched");
    expect(result.matchedFaqId).toBe("support-contact");
  });

  test("does not hijack domain support wording in non-support FAQs", () => {
    const result = matchFaq("How does LOCVM support quality candidates?");
    expect(result.status).toBe("matched");
    expect(result.matchedFaqId).toBe("quality-candidates");
  });

  test("returns no_match for empty input", () => {
    const result = matchFaq("   ");
    expect(result.status).toBe("no_match");
    expect(result.matchedFaqId).toBeNull();
    expect(result.matchScore).toBeNull();
    expect(result.links).toEqual([]);
  });

  test("returns no_match for single low-signal input", () => {
    const result = matchFaq("hello");
    expect(result.status).toBe("no_match");
    expect(result.matchedFaqId).toBeNull();
  });

  test("returns no_match for unrelated text", () => {
    const result = matchFaq("zxqv mnbvc plmokn");
    expect(result.status).toBe("no_match");
    expect(result.matchedFaqId).toBeNull();
    expect(result.answer.toLowerCase()).toContain("could not find");
  });
});

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

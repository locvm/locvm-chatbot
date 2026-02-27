import { GET, POST } from "@/app/api/faq/route";
import { getDb } from "@/src/lib/db";

jest.mock("@/src/lib/db", () => ({
  getDb: jest.fn(),
}));

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;

function makeFaqPostRequest(
  body: unknown,
  ip = "198.51.100.100"
): Request {
  return new Request("http://localhost/api/faq", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": ip,
    },
    body: JSON.stringify(body),
  });
}

function installCreateMock(createImpl?: () => Promise<{ id: string }>) {
  const create =
    createImpl ??
    jest.fn(async () => ({
      id: "interaction-1",
    }));

  mockedGetDb.mockReturnValue({
    interactionLog: {
      create,
    },
  } as never);

  return create;
}

describe("app/api/faq/route", () => {
  beforeEach(() => {
    delete (globalThis as { rateLimitStore?: unknown }).rateLimitStore;
    jest.clearAllMocks();
    installCreateMock();
  });

  test("GET returns method not allowed", async () => {
    const response = await GET(new Request("http://localhost/api/faq") as never);
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ message: "Method not allowed" });
  });

  test("POST rejects invalid body", async () => {
    const response = await POST(
      makeFaqPostRequest({
        question: "What is LOCVM?",
      }) as never
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  });

  test("POST returns matched FAQ and logs interaction", async () => {
    const create = installCreateMock();
    const response = await POST(
      makeFaqPostRequest({
        userId: " user-123 ",
        question: "I want a locum opening in Toronto",
      }) as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("matched");
    expect(payload.matchedFaqId).toBe("find-locum-openings-in-toronto");
    expect(payload.interactionId).toBe("interaction-1");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-123",
        question: "I want a locum opening in Toronto",
      }),
    });
  });

  test("POST still returns FAQ answer when DB logging fails", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    installCreateMock(
      jest.fn(async () => {
        throw new Error("db unavailable");
      })
    );

    const response = await POST(
      makeFaqPostRequest({
        userId: "user-234",
        question: "What is LOCVM?",
      }) as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("matched");
    expect(payload.matchedFaqId).toBe("what-is-locvm");
    expect(payload.interactionId).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "faq_log_write_failed",
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  test("POST enforces rate limit after max requests", async () => {
    const ip = "198.51.100.200";
    for (let i = 0; i < 25; i += 1) {
      const allowed = await POST(
        makeFaqPostRequest(
          { userId: "rate-user", question: "What is LOCVM?" },
          ip
        ) as never
      );
      expect(allowed.status).toBe(200);
    }

    const blocked = await POST(
      makeFaqPostRequest(
        { userId: "rate-user", question: "What is LOCVM?" },
        ip
      ) as never
    );
    const payload = await blocked.json();

    expect(blocked.status).toBe(429);
    expect(payload.error).toBe("rate_limited");
    expect(payload.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.headers.get("x-ratelimit-limit")).toBe("25");
    expect(blocked.headers.get("x-ratelimit-remaining")).toBe("0");
  });
});

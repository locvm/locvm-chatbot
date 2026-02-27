import { GET, OPTIONS, POST } from "@/app/api/faq/feedback/route";
import { getDb } from "@/src/lib/db";

jest.mock("@/src/lib/db", () => ({
  getDb: jest.fn(),
}));

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;
const EXPECTED_CORS_ORIGIN = "http://localhost:3000";

function makeFeedbackPostRequest(
  body: unknown,
  ip = "203.0.113.100"
): Request {
  return new Request("http://localhost/api/faq/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": ip,
    },
    body: JSON.stringify(body),
  });
}

function installDbMocks({
  updateCount = 1,
  createdId = "interaction-created-1",
}: {
  updateCount?: number;
  createdId?: string;
} = {}) {
  const updateMany = jest.fn(async () => ({ count: updateCount }));
  const create = jest.fn(async () => ({ id: createdId }));

  mockedGetDb.mockReturnValue({
    interactionLog: {
      updateMany,
      create,
    },
  } as never);

  return { updateMany, create };
}

describe("app/api/faq/feedback/route", () => {
  beforeEach(() => {
    delete (globalThis as { rateLimitStore?: unknown }).rateLimitStore;
    jest.clearAllMocks();
    installDbMocks();
  });

  test("GET returns method not allowed", async () => {
    const response = await GET(
      new Request("http://localhost/api/faq/feedback") as never
    );
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ message: "Method not allowed" });
  });

  test("OPTIONS returns CORS preflight headers", async () => {
    const response = await OPTIONS(
      new Request("http://localhost/api/faq/feedback", {
        method: "OPTIONS",
        headers: {
          origin: EXPECTED_CORS_ORIGIN,
        },
      }) as never
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(EXPECTED_CORS_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
  });

  test("POST rejects invalid body", async () => {
    const response = await POST(
      makeFeedbackPostRequest({
        interactionId: "abc123",
      }) as never
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  });

  test("POST updates existing interaction feedback", async () => {
    const { updateMany } = installDbMocks({ updateCount: 1 });
    const response = await POST(
      makeFeedbackPostRequest({
        interactionId: "interaction-1",
        helpful: true,
      }) as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      interactionId: "interaction-1",
      helpful: true,
      resolutionMode: "updated_existing",
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(EXPECTED_CORS_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "interaction-1" },
      data: { wasHelpful: true },
    });
  });

  test("POST creates fallback interaction when interactionId is missing", async () => {
    const { create } = installDbMocks({ createdId: "interaction-fallback-1" });
    const response = await POST(
      makeFeedbackPostRequest({
        helpful: false,
        fallbackLog: {
          userId: "user-1",
          question: "What is LOCVM?",
          matchedFaqId: "what-is-locvm",
          matchScore: 5,
        },
      }) as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      interactionId: "interaction-fallback-1",
      helpful: false,
      resolutionMode: "created_from_feedback",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        question: "What is LOCVM?",
        matchedFaqId: "what-is-locvm",
        matchScore: 5,
        wasHelpful: false,
      },
    });
  });
});

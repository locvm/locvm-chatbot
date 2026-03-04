const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://locvm.ca",
  "https://www.locvm.ca",
];

const CORS_METHODS = "POST, OPTIONS";
const CORS_HEADERS = "Content-Type";

function getAllowedOrigins(): string[] {
  const configuredOrigins = process.env.ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return configuredOrigins?.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
}

export function buildCorsHeaders(
  request: Request,
  headers?: HeadersInit
): Headers {
  const responseHeaders = new Headers({
    "Access-Control-Allow-Methods": CORS_METHODS,
    "Access-Control-Allow-Headers": CORS_HEADERS,
    Vary: "Origin",
  });
  const requestOrigin = request.headers.get("origin");

  if (requestOrigin && getAllowedOrigins().includes(requestOrigin)) {
    responseHeaders.set("Access-Control-Allow-Origin", requestOrigin);
  }

  if (headers) {
    new Headers(headers).forEach((value, key) => {
      responseHeaders.set(key, value);
    });
  }

  return responseHeaders;
}

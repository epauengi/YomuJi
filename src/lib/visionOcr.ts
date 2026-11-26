export const OCR_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
export const OCR_MAX_DIMENSION = 4096;
export const OCR_MAX_PIXELS = 16_000_000;
export const OCR_DAILY_LIMIT = 30;
export const OCR_BODY_TIMEOUT_MS = 10_000;
export const OCR_VISION_TIMEOUT_MS = 15_000;
export const OCR_UPSTASH_TIMEOUT_MS = 5_000;
export const VISION_ANNOTATE_URL = 'https://vision.googleapis.com/v1/images:annotate';

export type OcrMimeType = 'image/jpeg' | 'image/png';
export type OcrHint = 'auto' | 'ja' | 'handwriting';

export type OcrFailure = {
  ok: false;
  status: number;
  error: string;
  retryAfter?: number;
};

export type OcrSuccess = {
  ok: true;
  text: string;
};

export type OcrResult = OcrSuccess | OcrFailure;

export type OcrDeps = {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: Date;
  bodyTimeoutMs?: number;
  visionTimeoutMs?: number;
  upstashTimeoutMs?: number;
  dailyLimit?: number;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const QUOTA_LUA_SCRIPT = [
  "local c = tonumber(redis.call('GET', KEYS[1]) or '0')",
  'if c >= tonumber(ARGV[1]) then',
  '  return c + 1',
  'end',
  "c = redis.call('INCR', KEYS[1])",
  "if c == 1 or redis.call('TTL', KEYS[1]) < 0 then",
  "  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))",
  'end',
  'return c',
].join('\n');

// Monotonic warm-instance short-circuit after Upstash confirms a UTC day is exhausted.
// Never caches "allowed" state; cold starts still query Upstash and fail closed.
let exhaustedQuotaSlot: { endpoint: string; key: string; limit: number } | null = null;

const ERROR_MESSAGES = {
  forbidden: 'Yêu cầu không hợp lệ.',
  invalidHint: 'Tùy chọn nhận diện không hợp lệ.',
  unsupportedMedia: 'Chỉ hỗ trợ ảnh JPEG hoặc PNG.',
  tooLarge: 'Ảnh vượt quá giới hạn 2 MB.',
  bodyTimeout: 'Quá thời gian đọc dữ liệu ảnh. Vui lòng thử lại.',
  emptyOrInvalidImage: 'Ảnh không hợp lệ hoặc bị hỏng.',
  dimensionsTooLarge: 'Kích thước ảnh vượt quá giới hạn cho phép.',
  dailyQuotaExceeded: 'Đã hết lượt nhận diện ảnh hôm nay. Vui lòng thử lại vào ngày mai (theo giờ UTC).',
  providerRateLimited: 'Hệ thống nhận diện tạm thời quá tải. Vui lòng thử lại sau.',
  timeout: 'Nhận diện ảnh quá thời gian chờ. Vui lòng thử lại.',
  unavailable: 'Dịch vụ nhận diện ảnh tạm thời không khả dụng.',
  ocrFailed: 'Không thể nhận diện ảnh lúc này. Vui lòng thử lại.',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorClass(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'timeout';
    return error.name || 'error';
  }
  return 'unknown';
}

function logOcrFailure(
  env: Record<string, string | undefined>,
  provider: 'upstash' | 'vision' | 'ocr',
  errorClass: string,
  status: number | null = null,
) {
  if (env.NODE_ENV === 'test') return;
  console.warn('API /api/ocr failure', { provider, errorClass, status });
}

function jsonResponse(body: Record<string, unknown>, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function firstHeaderToken(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first || null;
}

export function isSameOriginRequest(request: Request): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (secFetchSite && secFetchSite !== 'same-origin') {
    return false;
  }

  let reqUrl: URL;
  try {
    reqUrl = new URL(request.url);
  } catch {
    return false;
  }

  const host = firstHeaderToken(request.headers.get('x-forwarded-host'))
    || firstHeaderToken(request.headers.get('host'))
    || reqUrl.host;
  const proto = (firstHeaderToken(request.headers.get('x-forwarded-proto'))
    || reqUrl.protocol.replace(/:$/, '')).toLowerCase();

  if ((proto !== 'http' && proto !== 'https') || !host || /[\s/\\@?#]/.test(host)) {
    return false;
  }

  let expectedUrl: URL;
  try {
    expectedUrl = new URL(`${proto}://${host}`);
  } catch {
    return false;
  }
  if (
    expectedUrl.pathname !== '/'
    || expectedUrl.search !== ''
    || expectedUrl.hash !== ''
    || expectedUrl.username !== ''
    || expectedUrl.password !== ''
  ) {
    return false;
  }
  const expectedOrigin = expectedUrl.origin;

  const originHeader = request.headers.get('origin')?.trim();
  if (!originHeader) return false;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originHeader);
  } catch {
    return false;
  }

  if (
    (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:')
    || parsedOrigin.origin !== originHeader.toLowerCase()
  ) {
    return false;
  }

  return parsedOrigin.origin === expectedOrigin;
}

export function parseOcrHint(raw: string | null): OcrHint | null {
  if (raw === null || raw === '') return 'auto';
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'auto' || normalized === 'ja' || normalized === 'handwriting') {
    return normalized;
  }
  return null;
}

export function parseAllowedMime(contentType: string | null): OcrMimeType | null {
  if (!contentType) return null;
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase();
  if (mediaType === 'image/jpeg' || mediaType === 'image/png') {
    return mediaType;
  }
  return null;
}

function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.byteLength < 24) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ihdrLength = view.getUint32(8, false);
  const isIhdr = bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52;
  if (ihdrLength !== 13 || !isIhdr) return null;

  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return null;
  }

  let offset = 2;
  while (offset < bytes.byteLength) {
    if (bytes[offset] !== 0xff) return null;
    while (offset < bytes.byteLength && bytes[offset] === 0xff) {
      offset++;
    }
    if (offset >= bytes.byteLength) return null;

    const marker = bytes[offset++];
    if (marker === 0x00 || marker === 0xd9 || marker === 0xda) {
      return null;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > bytes.byteLength) return null;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) {
      return null;
    }

    const isSof = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf);

    if (isSof) {
      if (segmentLength < 7) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return { width, height };
    }

    offset += segmentLength;
  }

  return null;
}

export function inspectImageBytes(
  bytes: Uint8Array,
  declaredMime: OcrMimeType,
): { ok: true; width: number; height: number } | OcrFailure {
  const dimensions = declaredMime === 'image/png'
    ? parsePngDimensions(bytes)
    : parseJpegDimensions(bytes);

  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    return { ok: false, status: 400, error: ERROR_MESSAGES.emptyOrInvalidImage };
  }

  if (
    dimensions.width > OCR_MAX_DIMENSION
    || dimensions.height > OCR_MAX_DIMENSION
    || dimensions.width * dimensions.height > OCR_MAX_PIXELS
  ) {
    return { ok: false, status: 400, error: ERROR_MESSAGES.dimensionsTooLarge };
  }

  return { ok: true, width: dimensions.width, height: dimensions.height };
}

export async function readBoundedBody(
  request: Request,
  maxBytes = OCR_MAX_BYTES,
  timeoutMs = OCR_BODY_TIMEOUT_MS,
): Promise<{ ok: true; bytes: Uint8Array } | OcrFailure> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const trimmed = contentLengthHeader.trim();
    if (!/^\d+$/.test(trimmed)) {
      return { ok: false, status: 400, error: ERROR_MESSAGES.emptyOrInvalidImage };
    }
    const declaredLength = Number(trimmed);
    if (!Number.isSafeInteger(declaredLength) || declaredLength > maxBytes) {
      return { ok: false, status: 413, error: ERROR_MESSAGES.tooLarge };
    }
    if (declaredLength === 0) {
      return { ok: false, status: 400, error: ERROR_MESSAGES.emptyOrInvalidImage };
    }
  }

  if (!request.body) {
    return { ok: false, status: 400, error: ERROR_MESSAGES.emptyOrInvalidImage };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadlinePromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      void reader.cancel().catch(() => {});
      reject(new Error('body_timeout'));
    }, timeoutMs);
  });

  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadlinePromise]);
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: ERROR_MESSAGES.tooLarge };
      }
      chunks.push(value);
    }
  } catch {
    if (timedOut) {
      return { ok: false, status: 408, error: ERROR_MESSAGES.bodyTimeout };
    }
    return { ok: false, status: 400, error: ERROR_MESSAGES.emptyOrInvalidImage };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    return { ok: false, status: 400, error: ERROR_MESSAGES.emptyOrInvalidImage };
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes: result };
}

type UpstashConfig =
  | { kind: 'bypass' }
  | { kind: 'configured'; endpoint: string; token: string }
  | { kind: 'invalid'; failure: OcrFailure };

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === '[::1]';
}

function resolveUpstashConfig(env: Record<string, string | undefined>): UpstashConfig {
  const rawUrl = env.UPSTASH_REDIS_REST_URL?.trim();
  const rawToken = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const isDevOrTest = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

  if (!rawUrl && !rawToken) {
    if (isDevOrTest) {
      return { kind: 'bypass' };
    }
    logOcrFailure(env, 'upstash', 'missing_config');
    return { kind: 'invalid', failure: { ok: false, status: 503, error: ERROR_MESSAGES.unavailable } };
  }

  if (!rawUrl || !rawToken) {
    logOcrFailure(env, 'upstash', 'partial_config');
    return { kind: 'invalid', failure: { ok: false, status: 503, error: ERROR_MESSAGES.unavailable } };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    logOcrFailure(env, 'upstash', 'invalid_url');
    return { kind: 'invalid', failure: { ok: false, status: 503, error: ERROR_MESSAGES.unavailable } };
  }

  const allowedDevHttp = isDevOrTest
    && parsedUrl.protocol === 'http:'
    && isLoopbackHostname(parsedUrl.hostname);

  if (parsedUrl.username || parsedUrl.password || (parsedUrl.protocol !== 'https:' && !allowedDevHttp)) {
    logOcrFailure(env, 'upstash', 'insecure_url');
    return { kind: 'invalid', failure: { ok: false, status: 503, error: ERROR_MESSAGES.unavailable } };
  }

  return {
    kind: 'configured',
    endpoint: parsedUrl.toString().replace(/\/+$/, ''),
    token: rawToken,
  };
}

function getUtcDayWindow(now: Date): { key: string; retryAfterSeconds: number; ttlSeconds: number } {
  const utcDay = now.toISOString().slice(0, 10);
  const nextMidnightMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const retryAfterSeconds = Math.max(1, Math.ceil((nextMidnightMs - now.getTime()) / 1000));
  return {
    key: `ocr:quota:utc:${utcDay}`,
    retryAfterSeconds,
    ttlSeconds: retryAfterSeconds + 3600,
  };
}

// ponytail: global UTC-day counter only; put external WAF/edge rate limit in front for public deployment.
export async function consumeDailyQuota(
  options: OcrDeps = {},
  preResolved?: UpstashConfig,
): Promise<{ ok: true; count: number; bypassed?: boolean } | OcrFailure> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const limit = options.dailyLimit ?? OCR_DAILY_LIMIT;
  const timeoutMs = options.upstashTimeoutMs ?? OCR_UPSTASH_TIMEOUT_MS;

  const config = preResolved ?? resolveUpstashConfig(env);
  if (config.kind === 'bypass') {
    return { ok: true, count: 0, bypassed: true };
  }
  if (config.kind === 'invalid') {
    return config.failure;
  }

  const { endpoint, token } = config;
  const { key, retryAfterSeconds, ttlSeconds } = getUtcDayWindow(now);

  if (
    exhaustedQuotaSlot
    && exhaustedQuotaSlot.endpoint === endpoint
    && exhaustedQuotaSlot.key === key
    && exhaustedQuotaSlot.limit === limit
  ) {
    return {
      ok: false,
      status: 429,
      error: ERROR_MESSAGES.dailyQuotaExceeded,
      retryAfter: retryAfterSeconds,
    };
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(['EVAL', QUOTA_LUA_SCRIPT, '1', key, String(limit), String(ttlSeconds)]),
    });

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      logOcrFailure(env, 'upstash', 'http_error', response.status);
      return { ok: false, status: 503, error: ERROR_MESSAGES.unavailable };
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || payload.error !== undefined) {
      logOcrFailure(env, 'upstash', 'redis_error', response.status);
      return { ok: false, status: 503, error: ERROR_MESSAGES.unavailable };
    }

    const count = typeof payload.result === 'number' ? payload.result : Number.NaN;
    if (!Number.isInteger(count) || count < 1) {
      logOcrFailure(env, 'upstash', 'invalid_result', response.status);
      return { ok: false, status: 503, error: ERROR_MESSAGES.unavailable };
    }

    if (count > limit) {
      exhaustedQuotaSlot = { endpoint, key, limit };
      return {
        ok: false,
        status: 429,
        error: ERROR_MESSAGES.dailyQuotaExceeded,
        retryAfter: retryAfterSeconds,
      };
    }

    return { ok: true, count };
  } catch (error) {
    logOcrFailure(env, 'upstash', getErrorClass(error));
    return { ok: false, status: 503, error: ERROR_MESSAGES.unavailable };
  }
}

function buildImageContext(hint: OcrHint): Record<string, unknown> | undefined {
  if (hint === 'ja') return { languageHints: ['ja'] };
  if (hint === 'handwriting') return { languageHints: ['ja-t-i0-handwrit'] };
  return undefined;
}

function mapVisionHttpError(status: number): OcrFailure {
  if (status === 429) return { ok: false, status: 429, error: ERROR_MESSAGES.providerRateLimited };
  if (status === 400) return { ok: false, status: 400, error: ERROR_MESSAGES.emptyOrInvalidImage };
  if (status === 504) return { ok: false, status: 504, error: ERROR_MESSAGES.timeout };
  if (status === 401 || status === 403 || status >= 500) {
    return { ok: false, status: 503, error: ERROR_MESSAGES.unavailable };
  }
  return { ok: false, status: 502, error: ERROR_MESSAGES.ocrFailed };
}

function mapVisionGrpcError(code: unknown): OcrFailure {
  switch (code) {
    case 3: // INVALID_ARGUMENT
      return { ok: false, status: 400, error: ERROR_MESSAGES.emptyOrInvalidImage };
    case 4: // DEADLINE_EXCEEDED
      return { ok: false, status: 504, error: ERROR_MESSAGES.timeout };
    case 8: // RESOURCE_EXHAUSTED
      return { ok: false, status: 429, error: ERROR_MESSAGES.providerRateLimited };
    case 7: // PERMISSION_DENIED
    case 14: // UNAVAILABLE
    case 16: // UNAUTHENTICATED
      return { ok: false, status: 503, error: ERROR_MESSAGES.unavailable };
    default:
      return { ok: false, status: 502, error: ERROR_MESSAGES.ocrFailed };
  }
}

export async function callVisionDocumentOcr(
  bytes: Uint8Array,
  options: {
    apiKey: string;
    hint: OcrHint;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    env?: Record<string, string | undefined>;
  },
): Promise<OcrResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? OCR_VISION_TIMEOUT_MS;
  const env = options.env ?? process.env;

  const base64 = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  const imageContext = buildImageContext(options.hint);

  const annotateRequest: Record<string, unknown> = {
    image: { content: base64 },
    features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
  };
  if (imageContext) {
    annotateRequest.imageContext = imageContext;
  }

  try {
    const response = await fetchImpl(VISION_ANNOTATE_URL, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': options.apiKey,
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({ requests: [annotateRequest] }),
    });

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      logOcrFailure(env, 'vision', 'http_error', response.status);
      return mapVisionHttpError(response.status);
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.responses) || payload.responses.length === 0) {
      logOcrFailure(env, 'vision', 'invalid_response', response.status);
      return { ok: false, status: 502, error: ERROR_MESSAGES.ocrFailed };
    }

    const first = payload.responses[0];
    if (!isRecord(first)) {
      logOcrFailure(env, 'vision', 'invalid_response', response.status);
      return { ok: false, status: 502, error: ERROR_MESSAGES.ocrFailed };
    }

    if (isRecord(first.error)) {
      const code = typeof first.error.code === 'number' ? first.error.code : null;
      logOcrFailure(env, 'vision', 'provider_error', code);
      return mapVisionGrpcError(code);
    }

    let rawText = '';
    if (isRecord(first.fullTextAnnotation) && typeof first.fullTextAnnotation.text === 'string') {
      rawText = first.fullTextAnnotation.text;
    } else if (
      Array.isArray(first.textAnnotations)
      && isRecord(first.textAnnotations[0])
      && typeof first.textAnnotations[0].description === 'string'
    ) {
      rawText = first.textAnnotations[0].description;
    }

    return { ok: true, text: rawText.trim() };
  } catch (error) {
    const errorClass = getErrorClass(error);
    logOcrFailure(env, 'vision', errorClass);
    if (errorClass === 'timeout') {
      return { ok: false, status: 504, error: ERROR_MESSAGES.timeout };
    }
    return { ok: false, status: 503, error: ERROR_MESSAGES.unavailable };
  }
}

export async function handleOcrPost(request: Request, deps: OcrDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;

  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: ERROR_MESSAGES.forbidden }, 403);
  }

  let hint: OcrHint | null;
  try {
    hint = parseOcrHint(new URL(request.url).searchParams.get('hint'));
  } catch {
    return jsonResponse({ error: ERROR_MESSAGES.forbidden }, 403);
  }
  if (!hint) {
    return jsonResponse({ error: ERROR_MESSAGES.invalidHint }, 400);
  }

  const mime = parseAllowedMime(request.headers.get('content-type'));
  if (!mime) {
    return jsonResponse({ error: ERROR_MESSAGES.unsupportedMedia }, 415);
  }

  const apiKey = env.GOOGLE_CLOUD_VISION_API_KEY?.trim();
  if (!apiKey) {
    logOcrFailure(env, 'vision', 'missing_api_key');
    return jsonResponse({ error: ERROR_MESSAGES.unavailable }, 503);
  }

  const upstashConfig = resolveUpstashConfig(env);
  if (upstashConfig.kind === 'invalid') {
    return jsonResponse({ error: upstashConfig.failure.error }, upstashConfig.failure.status);
  }

  const bodyResult = await readBoundedBody(request, OCR_MAX_BYTES, deps.bodyTimeoutMs);
  if (!bodyResult.ok) {
    return jsonResponse({ error: bodyResult.error }, bodyResult.status);
  }

  const imageCheck = inspectImageBytes(bodyResult.bytes, mime);
  if (!imageCheck.ok) {
    return jsonResponse({ error: imageCheck.error }, imageCheck.status);
  }

  const quota = await consumeDailyQuota({ ...deps, env }, upstashConfig);
  if (!quota.ok) {
    const extraHeaders = quota.retryAfter !== undefined
      ? { 'Retry-After': String(quota.retryAfter) }
      : undefined;
    return jsonResponse({ error: quota.error }, quota.status, extraHeaders);
  }

  const ocr = await callVisionDocumentOcr(bodyResult.bytes, {
    apiKey,
    hint,
    fetchImpl: deps.fetchImpl,
    timeoutMs: deps.visionTimeoutMs,
    env,
  });

  if (!ocr.ok) {
    return jsonResponse({ error: ocr.error }, ocr.status);
  }

  return jsonResponse({ text: ocr.text }, 200);
}

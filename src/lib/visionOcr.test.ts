import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OCR_DAILY_LIMIT,
  OCR_MAX_BYTES,
  VISION_ANNOTATE_URL,
  handleOcrPost,
  inspectImageBytes,
  isSameOriginRequest,
} from './visionOcr';

function makePng(width: number, height: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(33));
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false); // IHDR length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

function makeJpeg(width: number, height: number, withApp0 = true): Uint8Array<ArrayBuffer> {
  const parts: number[] = [0xff, 0xd8];
  if (withApp0) {
    // APP0 segment: length = 6 (2 len + 4 payload)
    parts.push(0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46);
  }
  // SOF0 segment: length = 11 (2 len + 1 prec + 2 h + 2 w + 1 comp + 3 comp info)
  parts.push(
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
  );
  parts.push(0xff, 0xd9);
  const bytes = new Uint8Array(new ArrayBuffer(parts.length));
  bytes.set(parts);
  return bytes;
}

function makeRequest(options: {
  url?: string;
  body?: BodyInit | null;
  contentType?: string | null;
  origin?: string | null;
  secFetchSite?: string | null;
  extraHeaders?: Record<string, string>;
} = {}): Request {
  const headers = new Headers(options.extraHeaders);
  if (options.contentType !== null) {
    headers.set('content-type', options.contentType ?? 'image/jpeg');
  }
  if (options.origin !== null) {
    headers.set('origin', options.origin ?? 'https://yomuji.test');
  }
  if (options.secFetchSite !== null) {
    headers.set('sec-fetch-site', options.secFetchSite ?? 'same-origin');
  }

  const init: RequestInit & { duplex?: 'half' } = {
    method: 'POST',
    headers,
    body: options.body === undefined ? makeJpeg(320, 200) : options.body,
  };
  if (options.body instanceof ReadableStream) {
    init.duplex = 'half';
  }
  return new Request(options.url ?? 'https://yomuji.test/api/ocr', init);
}

function jsonHttp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('same-origin guard blocks cross-site, missing/null origin, and allows proxied same-origin', () => {
  assert.equal(isSameOriginRequest(makeRequest()), true);
  assert.equal(
    isSameOriginRequest(
      makeRequest({
        url: 'http://127.0.0.1:3000/api/ocr',
        origin: 'https://app.yomuji.jp',
        extraHeaders: {
          'x-forwarded-host': 'app.yomuji.jp',
          'x-forwarded-proto': 'https',
        },
      }),
    ),
    true,
  );
  assert.equal(isSameOriginRequest(makeRequest({ secFetchSite: 'cross-site' })), false);
  assert.equal(isSameOriginRequest(makeRequest({ secFetchSite: 'same-site' })), false);
  assert.equal(isSameOriginRequest(makeRequest({ origin: 'https://evil.example' })), false);
  assert.equal(isSameOriginRequest(makeRequest({ origin: 'null' })), false);
  assert.equal(isSameOriginRequest(makeRequest({ origin: null })), false);
});

test('POST /api/ocr rejects cross-site with 403, no-store, and no CORS headers', async () => {
  const res = await handleOcrPost(makeRequest({ origin: 'https://evil.example', secFetchSite: 'cross-site' }), {
    env: { NODE_ENV: 'test', GOOGLE_CLOUD_VISION_API_KEY: 'test-key' },
  });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  const body = await res.json();
  assert.equal(typeof body.error, 'string');
});

test('validation rejects multipart, bad MIME, bad hint, magic mismatch, and oversized dimensions', async () => {
  const baseEnv = { NODE_ENV: 'test', GOOGLE_CLOUD_VISION_API_KEY: 'test-key' };

  const multipartRes = await handleOcrPost(
    makeRequest({ contentType: 'multipart/form-data; boundary=abc' }),
    { env: baseEnv },
  );
  assert.equal(multipartRes.status, 415);
  assert.equal(multipartRes.headers.get('cache-control'), 'no-store');

  const webpRes = await handleOcrPost(makeRequest({ contentType: 'image/webp' }), { env: baseEnv });
  assert.equal(webpRes.status, 415);

  const badHintRes = await handleOcrPost(
    makeRequest({ url: 'https://yomuji.test/api/ocr?hint=invalid' }),
    { env: baseEnv },
  );
  assert.equal(badHintRes.status, 400);

  // PNG bytes sent with image/jpeg Content-Type
  const mismatchRes = await handleOcrPost(
    makeRequest({ contentType: 'image/jpeg', body: makePng(100, 100) }),
    { env: baseEnv },
  );
  assert.equal(mismatchRes.status, 400);

  // Random bytes sent with image/png Content-Type
  const fakePngRes = await handleOcrPost(
    makeRequest({ contentType: 'image/png', body: new TextEncoder().encode('<svg></svg>') }),
    { env: baseEnv },
  );
  assert.equal(fakePngRes.status, 400);

  // Oversized width (> 4096) and decompression bomb (> 16M pixels)
  assert.equal(inspectImageBytes(makePng(4097, 100), 'image/png').ok, false);
  assert.equal(inspectImageBytes(makePng(4096, 4096), 'image/png').ok, false);
  assert.equal(inspectImageBytes(makeJpeg(4000, 4000), 'image/jpeg').ok, true);
  assert.equal(inspectImageBytes(makeJpeg(0, 100), 'image/jpeg').ok, false);
});

test('read-stream size cap enforces 2 MiB regardless of missing or spoofed Content-Length', async () => {
  const baseEnv = { NODE_ENV: 'test', GOOGLE_CLOUD_VISION_API_KEY: 'test-key' };

  // Declared Content-Length > 2 MiB rejected before reading
  const bigHeaderRes = await handleOcrPost(
    makeRequest({
      body: makeJpeg(10, 10),
      extraHeaders: { 'content-length': String(OCR_MAX_BYTES + 1) },
    }),
    { env: baseEnv },
  );
  assert.equal(bigHeaderRes.status, 413);

  // Streamed > 2 MiB with NO Content-Length cancels reader immediately
  let chunksPulled = 0;
  let canceled = false;
  const chunkSize = 512 * 1024;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      chunksPulled++;
      controller.enqueue(new Uint8Array(chunkSize));
      if (chunksPulled >= 10) controller.close();
    },
    cancel() {
      canceled = true;
    },
  });

  const streamRes = await handleOcrPost(
    makeRequest({
      body: stream,
      extraHeaders: { 'content-length': '64' }, // spoofed smaller length
    }),
    { env: baseEnv },
  );
  assert.equal(streamRes.status, 413);
  assert.equal(canceled, true);
  assert.equal(chunksPulled, 5); // 4 * 512 KiB = 2 MiB, 5th triggers immediate cancel
});

test('rate limiter fails closed in production when unwired, partial, or Upstash errors; allows dev/test when both absent', async () => {
  let visionCalls = 0;
  const spyFetch: typeof fetch = async () => {
    visionCalls++;
    return jsonHttp({ responses: [{ fullTextAnnotation: { text: '日本語' } }] });
  };

  // Production with no Upstash env -> fail closed 503
  const prodUnwired = await handleOcrPost(makeRequest(), {
    env: { NODE_ENV: 'production', GOOGLE_CLOUD_VISION_API_KEY: 'secret-key' },
    fetchImpl: spyFetch,
  });
  assert.equal(prodUnwired.status, 503);
  assert.equal(visionCalls, 0);

  // Unset NODE_ENV with no Upstash env -> fail closed 503
  const unsetEnvUnwired = await handleOcrPost(makeRequest(), {
    env: { GOOGLE_CLOUD_VISION_API_KEY: 'secret-key' },
    fetchImpl: spyFetch,
  });
  assert.equal(unsetEnvUnwired.status, 503);
  assert.equal(visionCalls, 0);

  // Partial Upstash config in dev -> fail closed 503
  const partialDev = await handleOcrPost(makeRequest(), {
    env: {
      NODE_ENV: 'development',
      GOOGLE_CLOUD_VISION_API_KEY: 'secret-key',
      UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
    },
    fetchImpl: spyFetch,
  });
  assert.equal(partialDev.status, 503);
  assert.equal(visionCalls, 0);

  // Dev with both absent -> allowed for local testing
  const devBypass = await handleOcrPost(makeRequest(), {
    env: { NODE_ENV: 'development', GOOGLE_CLOUD_VISION_API_KEY: 'secret-key' },
    fetchImpl: spyFetch,
  });
  assert.equal(devBypass.status, 200);
  assert.deepEqual(await devBypass.json(), { text: '日本語' });
  assert.equal(visionCalls, 1);

  // Upstash configured but fails (500) -> fail closed 503, Vision not called
  const upstashError = await handleOcrPost(makeRequest(), {
    env: {
      NODE_ENV: 'production',
      GOOGLE_CLOUD_VISION_API_KEY: 'secret-key',
      UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
    },
    fetchImpl: async (input) => {
      if (String(input).startsWith('https://redis.upstash.io')) {
        return jsonHttp({ error: 'ERR' }, 500);
      }
      visionCalls++;
      return jsonHttp({ responses: [{}] });
    },
  });
  assert.equal(upstashError.status, 503);
  assert.equal(visionCalls, 1);
});

test('Upstash atomic quota enforces 30 requests/UTC day, avoids post-limit INCR/calls, and resets next UTC day', async () => {
  const countsByKey = new Map<string, number>([['ocr:quota:utc:2026-11-24', OCR_DAILY_LIMIT - 1]]);
  let upstashCalls = 0;
  let visionCalls = 0;
  let capturedUpstashAuth = '';
  let capturedUpstashBody: unknown = null;

  const env = {
    NODE_ENV: 'production',
    GOOGLE_CLOUD_VISION_API_KEY: 'secret-key',
    UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io/',
    UPSTASH_REDIS_REST_TOKEN: 'upstash-secret',
  };
  const fixedNow = new Date('2026-11-24T23:50:00.000Z'); // 600s until UTC midnight

  const mockFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://redis.upstash.io') {
      upstashCalls++;
      capturedUpstashAuth = new Headers(init?.headers).get('authorization') ?? '';
      const cmd = JSON.parse(String(init?.body)) as string[];
      capturedUpstashBody = cmd;
      const key = cmd[3];
      const limit = Number(cmd[4]);
      const current = countsByKey.get(key) ?? 0;
      if (current >= limit) {
        return jsonHttp({ result: current + 1 });
      }
      countsByKey.set(key, current + 1);
      return jsonHttp({ result: current + 1 });
    }
    visionCalls++;
    return jsonHttp({ responses: [{ fullTextAnnotation: { text: '漢字\n' } }] });
  };

  // 30th request succeeds
  const okRes = await handleOcrPost(makeRequest(), { env, fetchImpl: mockFetch, now: fixedNow });
  assert.equal(okRes.status, 200);
  assert.deepEqual(await okRes.json(), { text: '漢字' });
  assert.equal(capturedUpstashAuth, 'Bearer upstash-secret');
  assert.ok(Array.isArray(capturedUpstashBody));
  assert.equal(capturedUpstashBody[0], 'EVAL');
  assert.equal(String(capturedUpstashBody[1]).includes("redis.call('GET'"), true);
  assert.equal(capturedUpstashBody[2], '1');
  assert.equal(capturedUpstashBody[3], 'ocr:quota:utc:2026-11-24');
  assert.equal(capturedUpstashBody[4], String(OCR_DAILY_LIMIT));
  assert.equal(capturedUpstashBody[5], '4200');
  assert.equal(upstashCalls, 1);
  assert.equal(visionCalls, 1);

  // 31st request hits Upstash once, blocked with 429, Vision NOT called
  const blockedRes = await handleOcrPost(makeRequest(), { env, fetchImpl: mockFetch, now: fixedNow });
  assert.equal(blockedRes.status, 429);
  assert.equal(blockedRes.headers.get('retry-after'), '600');
  assert.equal(blockedRes.headers.get('cache-control'), 'no-store');
  assert.equal(upstashCalls, 2);
  assert.equal(visionCalls, 1);
  const body = await blockedRes.json();
  assert.equal(typeof body.error, 'string');

  // 32nd request on same UTC day short-circuits locally: 0 extra Upstash calls, 0 Vision calls
  const spamRes = await handleOcrPost(makeRequest(), { env, fetchImpl: mockFetch, now: fixedNow });
  assert.equal(spamRes.status, 429);
  assert.equal(spamRes.headers.get('retry-after'), '600');
  assert.equal(upstashCalls, 2);
  assert.equal(visionCalls, 1);

  // Next UTC day resets automatically and queries Upstash for new UTC date key
  const nextDay = new Date('2026-11-25T00:00:05.000Z');
  const nextDayRes = await handleOcrPost(makeRequest(), { env, fetchImpl: mockFetch, now: nextDay });
  assert.equal(nextDayRes.status, 200);
  assert.equal(upstashCalls, 3);
  assert.equal(visionCalls, 2);
  assert.equal((capturedUpstashBody as string[])[3], 'ocr:quota:utc:2026-11-25');
});

test('Vision OCR sends DOCUMENT_TEXT_DETECTION inline base64 with x-goog-api-key header, supports hints and empty 200', async () => {
  const pngBytes = makePng(200, 100);
  const captured: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];

  const mockFetch: typeof fetch = async (input, init) => {
    captured.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    if (captured.length === 1) {
      return jsonHttp({ responses: [{ fullTextAnnotation: { text: '  縦書きの日本語  \n' } }] });
    }
    return jsonHttp({ responses: [{}] });
  };

  const env = { NODE_ENV: 'test', GOOGLE_CLOUD_VISION_API_KEY: 'vision-secret-123' };

  // Default hint=auto: no imageContext
  const res1 = await handleOcrPost(
    makeRequest({ contentType: 'image/png', body: pngBytes }),
    { env, fetchImpl: mockFetch },
  );
  assert.equal(res1.status, 200);
  assert.equal(res1.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res1.json(), { text: '縦書きの日本語' });

  assert.equal(captured[0].url, VISION_ANNOTATE_URL);
  assert.equal(captured[0].url.includes('vision-secret-123'), false);
  assert.equal(captured[0].headers.get('x-goog-api-key'), 'vision-secret-123');

  const req0 = (captured[0].body.requests as Array<Record<string, unknown>>)[0];
  assert.deepEqual(req0.features, [{ type: 'DOCUMENT_TEXT_DETECTION' }]);
  assert.deepEqual(req0.image, { content: Buffer.from(pngBytes).toString('base64') });
  assert.equal('imageContext' in req0, false);

  // Hint=ja + empty Vision response -> 200 { text: "" }
  const res2 = await handleOcrPost(
    makeRequest({ url: 'https://yomuji.test/api/ocr?hint=ja', contentType: 'image/png', body: pngBytes }),
    { env, fetchImpl: mockFetch },
  );
  assert.equal(res2.status, 200);
  assert.deepEqual(await res2.json(), { text: '' });
  const req1 = (captured[1].body.requests as Array<Record<string, unknown>>)[0];
  assert.deepEqual(req1.imageContext, { languageHints: ['ja'] });
});

test('Vision failures map safely without retry or leaking provider details', async () => {
  const env = { NODE_ENV: 'test', GOOGLE_CLOUD_VISION_API_KEY: 'vision-secret-123' };

  // Missing API key -> 503
  const missingKey = await handleOcrPost(makeRequest(), { env: { NODE_ENV: 'test' } });
  assert.equal(missingKey.status, 503);

  // Vision HTTP 429 -> 429, no retry
  let calls = 0;
  const http429 = await handleOcrPost(makeRequest(), {
    env,
    fetchImpl: async () => {
      calls++;
      return jsonHttp({ error: { message: 'Quota exceeded for vision-secret-123' } }, 429);
    },
  });
  assert.equal(calls, 1);
  assert.equal(http429.status, 429);
  const body429 = await http429.json();
  assert.equal(String(body429.error).includes('vision-secret-123'), false);

  // Vision gRPC RESOURCE_EXHAUSTED (code 8) inside HTTP 200 -> 429
  const grpcQuota = await handleOcrPost(makeRequest(), {
    env,
    fetchImpl: async () => jsonHttp({ responses: [{ error: { code: 8, message: 'Quota' } }] }),
  });
  assert.equal(grpcQuota.status, 429);

  // Vision timeout -> 504, no retry
  let timeoutCalls = 0;
  const timeoutRes = await handleOcrPost(makeRequest(), {
    env,
    fetchImpl: async () => {
      timeoutCalls++;
      const err = new Error('timed out');
      err.name = 'TimeoutError';
      throw err;
    },
  });
  assert.equal(timeoutCalls, 1);
  assert.equal(timeoutRes.status, 504);

  // Vision HTTP 500 -> 503, no retry
  let serverErrCalls = 0;
  const serverErr = await handleOcrPost(makeRequest(), {
    env,
    fetchImpl: async () => {
      serverErrCalls++;
      return jsonHttp({ error: 'internal' }, 500);
    },
  });
  assert.equal(serverErrCalls, 1);
  assert.equal(serverErr.status, 503);
});

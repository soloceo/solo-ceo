import {
  type HandlerCtx, type HandlerResult,
  ok,
} from './_shared';

export async function serverHandler({ path, method }: HandlerCtx): Promise<HandlerResult | null> {
  // ── SERVER TIME (local clock) ────────────────────────────────────
  if (path === '/api/server-info' && method === 'GET') {
    return ok({ name: '一人CEO Local', cloud: false });
  }

  if (path === '/api/server-time' && method === 'GET') {
    return ok({ unixMs: Date.now() });
  }

  return null;
}

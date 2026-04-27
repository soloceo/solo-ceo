import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleSupabaseRequest: vi.fn(),
  initDb: vi.fn(),
  handleApiRequest: vi.fn(),
  enqueue: vi.fn(),
  initSyncManager: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheToResponse: vi.fn(),
  isFresh: vi.fn(),
  invalidateForMutation: vi.fn(),
  notifyUpdate: vi.fn(),
  clearCache: vi.fn(),
  cacheVersion: vi.fn(),
}));

vi.mock('./supabase-api', () => ({ handleSupabaseRequest: mocks.handleSupabaseRequest }));
vi.mock('./api', () => ({
  initDb: mocks.initDb,
  handleApiRequest: mocks.handleApiRequest,
}));
vi.mock('./offline-queue', () => ({ enqueue: mocks.enqueue }));
vi.mock('./sync-manager', () => ({ initSyncManager: mocks.initSyncManager }));
vi.mock('./supabase-client', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));
vi.mock('./data-cache', () => ({
  cacheGet: mocks.cacheGet,
  cacheSet: mocks.cacheSet,
  cacheToResponse: mocks.cacheToResponse,
  isFresh: mocks.isFresh,
  invalidateForMutation: mocks.invalidateForMutation,
  notifyUpdate: mocks.notifyUpdate,
  clearCache: mocks.clearCache,
  cacheVersion: mocks.cacheVersion,
}));

describe('supabase interceptor offline queueing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.initDb.mockResolvedValue(undefined);
    mocks.handleApiRequest.mockResolvedValue({ status: 200, data: { id: 42 } });
    mocks.enqueue.mockResolvedValue(undefined);
    mocks.cacheGet.mockReturnValue(null);
    mocks.cacheVersion.mockReturnValue(0);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', { fetch: vi.fn().mockResolvedValue(new Response('{}')) });
  });

  it('keeps unauthenticated mutations local-only instead of queueing them', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    const { installSupabaseInterceptor } = await import('./supabase-interceptor');

    await installSupabaseInterceptor();
    await window.fetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'local only' }),
    });

    expect(mocks.handleSupabaseRequest).not.toHaveBeenCalled();
    expect(mocks.handleApiRequest).toHaveBeenCalledWith('POST', '/api/tasks', { title: 'local only' });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('queues authenticated mutations when the browser is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    const { installSupabaseInterceptor } = await import('./supabase-interceptor');

    await installSupabaseInterceptor();
    await window.fetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'sync later' }),
    });

    expect(mocks.handleSupabaseRequest).not.toHaveBeenCalled();
    expect(mocks.enqueue).toHaveBeenCalledWith('POST', '/api/tasks', { title: 'sync later' }, 42, 'user-1');
  });

  it('does not enqueue mutations when Supabase returns an HTTP 500 response', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mocks.handleSupabaseRequest.mockResolvedValue({ status: 500, data: { error: 'remote schema error' } });
    const { installSupabaseInterceptor } = await import('./supabase-interceptor');

    await installSupabaseInterceptor();
    const response = await window.fetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'do not queue deterministic failure' }),
    });

    expect(response.status).toBe(500);
    expect(mocks.handleApiRequest).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});

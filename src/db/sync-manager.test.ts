import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const select = vi.fn();
  return {
    select,
    supabase: {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
      from: vi.fn(() => ({ select })),
    },
    getQueueLength: vi.fn(),
    replayQueue: vi.fn(),
    getDb: vi.fn(),
    saveDb: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    exec: vi.fn(),
    clearCache: vi.fn(),
    setSyncStatus: vi.fn(),
    setPendingOps: vi.fn(),
  };
});

vi.mock('./supabase-client', () => ({ supabase: mocks.supabase }));
vi.mock('./offline-queue', () => ({
  getQueueLength: mocks.getQueueLength,
  replayQueue: mocks.replayQueue,
}));
vi.mock('./index', () => ({
  getDb: mocks.getDb,
  saveDb: mocks.saveDb,
  all: mocks.all,
  run: mocks.run,
  exec: mocks.exec,
}));
vi.mock('./data-cache', () => ({ clearCache: mocks.clearCache }));
vi.mock('../store/useSettingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      setSyncStatus: mocks.setSyncStatus,
      setPendingOps: mocks.setPendingOps,
    }),
  },
}));

describe('sync manager', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.select.mockResolvedValue({ data: [], error: null });
    mocks.getQueueLength.mockResolvedValue(0);
    mocks.getDb.mockResolvedValue({});
    mocks.saveDb.mockResolvedValue(undefined);
    mocks.all.mockReturnValue([]);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it('releases the sync gate after a no-session cold start', async () => {
    const signedInSession = { user: { id: 'user-1' } };
    mocks.supabase.auth.getSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: signedInSession } });

    const { triggerFullSync } = await import('./sync-manager');

    await triggerFullSync();
    await triggerFullSync();

    expect(mocks.supabase.auth.getSession).toHaveBeenCalledTimes(2);
    expect(mocks.getQueueLength).toHaveBeenCalled();
    expect(mocks.supabase.from).toHaveBeenCalledWith('leads');
  });
});

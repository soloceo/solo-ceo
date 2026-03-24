import React, { useState, useCallback, useMemo } from "react";
import { CheckSquare, Square, RotateCcw, Flame } from "lucide-react";
import { useT } from "../i18n/context";
import { PROTOCOL_STEPS } from "../data/evolution-protocol";
import { useAppSettings, invalidateSettingsCache } from "../hooks/useAppSettings";

/**
 * Compact DailyProtocol for Home dashboard.
 * Uses shared settings cache to avoid duplicate API calls.
 * Includes streak tracking + completion celebration.
 */
export default function DailyProtocol() {
  const { t, lang } = useT();
  const L = useCallback((o: { zh: string; en: string }) => o[lang] || o.en, [lang]);

  const today = new Date().toISOString().split("T")[0];
  const [protocol, setProtocol] = useState<{ date: string; checks: boolean[] }>({
    date: "", checks: [false, false, false, false, false],
  });
  const [streak, setStreak] = useState<{ count: number; lastDate: string }>({ count: 0, lastDate: "" });
  const [inited, setInited] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }, []);

  const { settings, loaded, save } = useAppSettings();

  // Initialize from shared cache (runs once)
  if (loaded && !inited) {
    if (settings?.evolution_protocol) {
      try {
        const p = JSON.parse(settings.evolution_protocol);
        if (p.date === today) setProtocol(p);
      } catch {}
    }
    if (settings?.protocol_streak) {
      try {
        const s = JSON.parse(settings.protocol_streak);
        if (s.lastDate === today || s.lastDate === yesterday) setStreak(s);
      } catch {}
    }
    setInited(true);
  }

  const persist = useCallback(async (next: { date: string; checks: boolean[] }) => {
    setProtocol(next);
    invalidateSettingsCache();

    const allDone = next.checks.every(Boolean);
    if (allDone && !protocol.checks.every(Boolean)) {
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 3000);

      const newStreak = {
        count: (streak.lastDate === yesterday || streak.lastDate === today) ? streak.count + 1 : 1,
        lastDate: today,
      };
      if (streak.lastDate !== today) {
        setStreak(newStreak);
        await save("protocol_streak", JSON.stringify(newStreak));
      }
    }

    await save("evolution_protocol", JSON.stringify(next));
  }, [protocol.checks, streak, today, yesterday, save]);

  if (!inited) return null;

  const checks = protocol.checks;
  const done = checks.filter(Boolean).length;
  const pct = Math.round((done / 5) * 100);
  const allDone = done === 5;

  const toggle = (idx: number) => {
    const next = [...checks];
    next[idx] = !next[idx];
    persist({ date: today, checks: next });
  };

  const reset = () => persist({ date: today, checks: [false, false, false, false, false] });

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="section-label">{t("home.protocol.title" as any)}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{t("home.protocol.desc" as any)}</p>
          </div>
          {streak.count > 1 && (
            <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--warning)" }}>
              <Flame size={16} /> {streak.count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tabular-nums" style={{ color: allDone ? "var(--success)" : "var(--text-secondary)" }}>
            {done}/5
          </span>
          {done > 0 && (
            <button onClick={reset} className="btn-ghost text-[11px] p-0.5" style={{ color: "var(--text-secondary)" }}>
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>

      {/* progress bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--surface-alt)" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: allDone ? "var(--success)" : "var(--accent)" }}
        />
      </div>

      {/* celebration */}
      {justCompleted && (
        <div className="mb-3 py-3 px-4 rounded-xl text-center text-[13px] font-semibold celebrate-bounce" style={{ background: "var(--success-light)", color: "var(--success)" }}>
          {t("home.protocol.allDone" as any)}
        </div>
      )}

      {/* compact step list */}
      <div className="card overflow-hidden">
        {PROTOCOL_STEPS.map((step, idx) => {
          const checked = checks[idx];
          return (
            <button
              key={step.id}
              onClick={() => toggle(idx)}
              className="list-item w-full text-left"
              style={checked ? { background: "color-mix(in srgb, var(--success) 5%, transparent)" } : {}}
            >
              {checked ? (
                <CheckSquare size={16} className="shrink-0" style={{ color: "var(--success)" }} />
              ) : (
                <Square size={16} className="shrink-0" style={{ color: "var(--border-strong)" }} />
              )}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="badge shrink-0" style={{ color: "var(--accent)", fontSize: 10 }}>{L(step.time)}</span>
                <span className={`text-[13px] truncate ${checked ? "line-through" : ""}`} style={checked ? { color: "var(--text-secondary)" } : {}}>
                  {L(step.title)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { RotateCcw, SkipForward } from "lucide-react";
import { useT } from "../../../i18n/context";
import { useWidgetScale } from "./useWidgetScale";

type Mode = "work" | "break" | "longBreak";
const WORK_S = 25 * 60;
const BREAK_S = 5 * 60;
const LONG_BREAK_S = 15 * 60;
const SESSIONS_FOR_LONG_BREAK = 4;
const SESSION_STORAGE_KEY = "solo-ceo-pomodoro-sessions";

interface SessionData { date: string; count: number; totalMinutes: number; }

function todayStr(): string { return new Date().toISOString().slice(0, 10); }

function loadSessions(): SessionData {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.date === todayStr()) return { ...data, totalMinutes: data.totalMinutes || data.count * 25 };
    }
  } catch {}
  return { date: todayStr(), count: 0, totalMinutes: 0 };
}

function saveSessions(data: SessionData) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc2.start(ctx.currentTime + 0.15); osc2.stop(ctx.currentTime + 0.7);
    setTimeout(() => ctx.close(), 1000);
  } catch {}
}

/* ── Tiny play/pause icon inside ring ── */
function PlayPauseIcon({ running, color, s }: { running: boolean; color: string; s: (px: number) => number }) {
  if (running) {
    return (
      <svg width={s(10)} height={s(10)} viewBox="0 0 10 10" style={{ marginTop: 2 }}>
        <rect x={1.5} y={1} width={2.5} height={8} rx={0.8} fill={color} />
        <rect x={6} y={1} width={2.5} height={8} rx={0.8} fill={color} />
      </svg>
    );
  }
  return (
    <svg width={s(10)} height={s(10)} viewBox="0 0 10 10" style={{ marginTop: 2 }}>
      <polygon points="2.5,1 9,5 2.5,9" fill={color} />
    </svg>
  );
}

export default function PomodoroWidget() {
  const { t } = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const { scale, s } = useWidgetScale(rootRef);
  const [mode, setMode] = useState<Mode>("work");
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(WORK_S);
  const [sessions, setSessions] = useState<SessionData>(() => loadSessions());
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentSession = (sessions.count % SESSIONS_FOR_LONG_BREAK) + 1;

  const total = useMemo(() => {
    if (mode === "work") return WORK_S;
    if (mode === "longBreak") return LONG_BREAK_S;
    return BREAK_S;
  }, [mode]);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const clear = useCallback(() => {
    if (ref.current) { clearInterval(ref.current); ref.current = null; }
  }, []);

  useEffect(() => {
    if (!running) { clear(); return; }
    ref.current = setInterval(() => {
      setTimeLeft((p) => {
        if (p <= 1) {
          clear(); setRunning(false); playBeep();
          setMode((m) => {
            if (m === "work") {
              setSessions(prev => {
                const updated = prev.date === todayStr()
                  ? { date: prev.date, count: prev.count + 1, totalMinutes: (prev.totalMinutes || 0) + 25 }
                  : { date: todayStr(), count: 1, totalMinutes: 25 };
                saveSessions(updated);
                return updated;
              });
              return "break";
            } else {
              setTimeLeft(WORK_S);
              return "work";
            }
          });
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return clear;
  }, [running, clear]);

  const prevSessionCount = useRef(sessions.count);
  useEffect(() => {
    if (sessions.count > prevSessionCount.current && !running && mode === "break") {
      if (sessions.count % SESSIONS_FOR_LONG_BREAK === 0) {
        setMode("longBreak");
        setTimeLeft(LONG_BREAK_S);
      }
    }
    prevSessionCount.current = sessions.count;
  }, [sessions.count, running, mode]);

  useEffect(() => {
    const check = setInterval(() => {
      const current = loadSessions();
      if (current.date !== sessions.date) setSessions(current);
    }, 60000);
    return () => clearInterval(check);
  }, [sessions.date]);

  const reset = () => { clear(); setRunning(false); setMode("work"); setTimeLeft(WORK_S); };
  const skip = () => {
    clear(); setRunning(false);
    if (mode === "work") { setMode("break"); setTimeLeft(BREAK_S); }
    else { setMode("work"); setTimeLeft(WORK_S); }
  };
  const toggleRunning = useCallback(() => setRunning((r) => !r), []);

  const ringColor = mode === "work" ? "var(--color-accent)" : "var(--color-success)";
  const modeLabel = mode === "work"
    ? (t("widgets.pomodoro.work" as any) || "Focus")
    : mode === "longBreak"
      ? (t("widgets.pomodoro.longBreak" as any) || "Long Break")
      : (t("widgets.pomodoro.break" as any) || "Break");

  const focusTimeLabel = useMemo(() => {
    const mins = sessions.totalMinutes || sessions.count * 25;
    if (mins === 0) return "";
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? `${m}m` : ""}` : `${m}m`;
  }, [sessions]);

  const filledDots = sessions.count % SESSIONS_FOR_LONG_BREAK || (sessions.count > 0 && mode !== "work" ? SESSIONS_FOR_LONG_BREAK : 0);

  /* Ring */
  const RING_SIZE = s(80);
  const RING_R = s(35);
  const RING_C = 2 * Math.PI * RING_R;
  const STROKE_W = parseFloat((2.5 * scale).toFixed(1));
  const offset = RING_C * (1 - timeLeft / total);

  return (
    <div ref={rootRef} className="h-full flex flex-col overflow-hidden" style={{ padding: `${s(8)}px ${s(6)}px ${s(4)}px` }}>
      {/* Header: mode label + controls */}
      <div className="flex items-center shrink-0" style={{ marginBottom: s(2), gap: s(2), paddingInline: s(4) }}>
        <span className="flex-1 truncate" style={{ fontSize: s(13), fontWeight: 700, color: ringColor, lineHeight: 1 }}>
          {modeLabel}
        </span>
        <button
          onClick={reset}
          className="flex items-center justify-center shrink-0 press-feedback rounded-full transition-colors hover:bg-[var(--color-bg-tertiary)]"
          style={{ width: s(18), height: s(18), color: "var(--color-text-quaternary)" }}
          aria-label="Reset"
        >
          <RotateCcw size={s(10)} />
        </button>
        <button
          onClick={skip}
          className="flex items-center justify-center shrink-0 press-feedback rounded-full transition-colors hover:bg-[var(--color-bg-tertiary)]"
          style={{ width: s(18), height: s(18), color: "var(--color-text-quaternary)" }}
          aria-label="Skip"
        >
          <SkipForward size={s(10)} />
        </button>
      </div>

      {/* Ring timer — tap to play/pause */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <div
          className="relative cursor-pointer active:scale-95 transition-transform"
          style={{ width: RING_SIZE, height: RING_SIZE }}
          onClick={toggleRunning}
          role="button"
          aria-label={running ? "Pause" : "Play"}
        >
          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none" stroke="var(--color-bg-quaternary)" strokeWidth={STROKE_W} />
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none"
              stroke={ringColor} strokeWidth={STROKE_W} strokeLinecap="round"
              strokeDasharray={RING_C} strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.4s", transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="tabular-nums"
              style={{ fontSize: s(15), fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}
            >
              {mm}:{ss}
            </span>
            <PlayPauseIcon running={running} color="var(--color-text-quaternary)" s={s} />
          </div>
        </div>
      </div>

      {/* Bottom: dots + #session + focus time */}
      <div className="flex items-center justify-center" style={{ gap: s(4) }}>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map(n => (
            <div
              key={n}
              style={{
                width: s(4), height: s(4), borderRadius: s(2),
                background: n <= filledDots ? "var(--color-accent)" : "var(--color-bg-quaternary)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>
        <span className="tabular-nums" style={{ fontSize: s(9), color: "var(--color-text-quaternary)" }}>
          #{currentSession}
          {sessions.count > 0 && focusTimeLabel ? ` · ${focusTimeLabel}` : ""}
        </span>
      </div>
    </div>
  );
}

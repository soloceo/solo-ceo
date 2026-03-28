import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Coffee, Footprints, Moon, Zap, RotateCcw } from "lucide-react";
import { useT } from "../../../i18n/context";
import { useWidgetScale } from "./useWidgetScale";

/* ── Constants ── */
const STORAGE_KEY = "solo-ceo-energy-v3";
const WAKING_HOURS = 16;
const TICK_MS = 60_000;

const SLEEP_OPTIONS = [
  { key: "bad", startEnergy: 55, emoji: "😴" },
  { key: "ok", startEnergy: 75, emoji: "😐" },
  { key: "great", startEnergy: 100, emoji: "⚡" },
] as const;

const RECHARGE_OPTIONS = [
  { key: "coffee", icon: Coffee, amount: 8 },
  { key: "walk", icon: Footprints, amount: 12 },
  { key: "nap", icon: Moon, amount: 20 },
] as const;

/* ── Circadian drain modifier ── */
function circadianModifier(hoursSinceWake: number): number {
  if (hoursSinceWake < 3) return 0.6;
  if (hoursSinceWake < 6) return 0.9;
  if (hoursSinceWake < 9) return 1.5;
  if (hoursSinceWake < 12) return 1.0;
  if (hoursSinceWake < 14) return 1.3;
  return 0.8;
}

/* ── Calculate current energy ── */
function computeCurrentEnergy(state: DayState, now: Date): number {
  const wakeTime = new Date(state.wakeTimestamp);
  const hoursSinceWake = (now.getTime() - wakeTime.getTime()) / 3600000;
  if (hoursSinceWake < 0) return state.startEnergy;

  const steps = Math.floor(hoursSinceWake * 4);
  const baseRatePerStep = state.startEnergy / (WAKING_HOURS * 4);
  let totalDrain = 0;
  for (let i = 0; i < steps; i++) totalDrain += baseRatePerStep * circadianModifier(i / 4);

  const totalRecharge = state.recharges
    .filter(r => new Date(r.time).getTime() <= now.getTime())
    .reduce((sum, r) => sum + r.amount, 0);

  return Math.max(0, Math.min(100, Math.round(state.startEnergy - totalDrain + totalRecharge)));
}

/* ── Energy color ── */
function energyColor(pct: number): string {
  if (pct <= 20) return "var(--color-danger)";
  if (pct <= 40) return "var(--color-warning)";
  if (pct <= 70) return "var(--color-accent)";
  return "var(--color-success)";
}

/* ── Data types ── */
interface RechargeEvent { time: string; type: string; amount: number; }
interface DayState { date: string; startEnergy: number; wakeTimestamp: string; recharges: RechargeEvent[]; }
interface StorageData { today: DayState | null; history: { date: string; curve: number[] }[]; }

function todayStr(): string { return new Date().toISOString().slice(0, 10); }

function sampleDayCurve(state: DayState): number[] {
  const curve: number[] = [];
  const wake = new Date(state.wakeTimestamp);
  for (let h = 0; h <= WAKING_HOURS; h++) curve.push(computeCurrentEnergy(state, new Date(wake.getTime() + h * 3600000)));
  return curve;
}

function loadData(): StorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.today && parsed.today.date !== todayStr()) {
        if (parsed.today.wakeTimestamp) {
          const hist = (parsed.history || []).slice(-6);
          hist.push({ date: parsed.today.date, curve: sampleDayCurve(parsed.today) });
          parsed.history = hist;
        }
        parsed.today = null;
      }
      return parsed;
    }
  } catch {}
  return { today: null, history: [] };
}

function saveData(data: StorageData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ── Battery Shape SVG ── */
function BatteryShape({ level, color, s }: { level: number; color: string; s: (px: number) => number }) {
  const w = s(36), h = s(50), capH = s(5), capW = s(13), border = s(2), radius = s(5), fontSize = s(13);
  const innerH = h - border * 2;
  const fillH = Math.round((level / 100) * innerH);

  return (
    <div className="relative shrink-0" style={{ width: w, height: h + capH }}>
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: capW, height: capH,
        borderTopWidth: border, borderLeftWidth: border, borderRightWidth: border, borderBottomWidth: 0,
        borderStyle: "solid", borderColor: "var(--color-border-primary)", borderRadius: "3px 3px 0 0",
      }} />
      <div style={{
        position: "absolute", top: capH, left: 0, width: w, height: h,
        borderWidth: border, borderColor: "var(--color-border-primary)",
        borderRadius: radius, overflow: "hidden",
      }}>
        {level > 0 && (
          <div style={{
            position: "absolute", bottom: 0, left: 0,
            width: "100%", height: fillH,
            backgroundColor: color, opacity: 0.8,
            borderRadius: level >= 98 ? `${radius - s(2)}px ${radius - s(2)}px 0 0` : 0,
            transition: "height 1s ease, background-color 0.5s ease",
          }} />
        )}
        <div className="absolute inset-0 flex items-center justify-center tabular-nums" style={{
          fontSize, fontWeight: 700, color: "var(--color-text-primary)",
          textShadow: "0 1px 2px rgba(0,0,0,0.08)",
        }}>
          {level}
        </div>
      </div>
    </div>
  );
}

/* ── Main Widget ── */
export default function EnergyBatteryWidget() {
  const { t } = useT();
  const title = t("widgets.energy" as any) || "精力电池";
  const [data, setData] = useState<StorageData>(() => loadData());
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeFlash, setRechargeFlash] = useState("");
  const [currentEnergy, setCurrentEnergy] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const rootRef = useRef<HTMLDivElement>(null);
  const { s } = useWidgetScale(rootRef);

  const state = data.today;

  useEffect(() => {
    if (!state) return;
    const update = () => {
      const t = new Date();
      setCurrentEnergy(computeCurrentEnergy(state, t));
      setNow(t.getTime());
    };
    update();
    tickRef.current = setInterval(update, TICK_MS);
    return () => clearInterval(tickRef.current);
  }, [state]);

  const color = energyColor(currentEnergy);

  const hoursSinceWake = useMemo(() => {
    if (!state) return 0;
    return Math.max(0, (now - new Date(state.wakeTimestamp).getTime()) / 3600000);
  }, [state, now]);

  const handleMorningSet = useCallback((startEnergy: number) => {
    const newState: DayState = { date: todayStr(), startEnergy, wakeTimestamp: new Date().toISOString(), recharges: [] };
    const newData = { ...data, today: newState };
    setData(newData); saveData(newData);
  }, [data]);

  const handleRecharge = useCallback((type: string, amount: number) => {
    if (!state) return;
    const newState = { ...state, recharges: [...state.recharges, { time: new Date().toISOString(), type, amount }] };
    const newData = { ...data, today: newState };
    setData(newData); saveData(newData);
    setShowRecharge(false);
    setRechargeFlash(`+${amount}`);
    setTimeout(() => setRechargeFlash(""), 1500);
  }, [state, data]);

  const handleReset = useCallback(() => {
    setData(prev => { const next = { ...prev, today: null }; saveData(next); return next; });
    setShowRecharge(false);
  }, []);

  return (
    <div ref={rootRef} className="h-full flex flex-col overflow-hidden" style={{ padding: `${s(12)}px ${s(6)}px ${s(6)}px` }}>
      {!state ? (
        /* ── Morning Setup ── */
        <div className="flex-1 flex flex-col items-center" style={{ animation: "energyFadeIn 0.25s ease" }}>
          <span className="self-start" style={{ fontSize: s(13), fontWeight: 700, color: "var(--color-text-tertiary)", lineHeight: 1, marginBottom: s(4), paddingInline: s(4) }}>
            {title}
          </span>
          <div className="flex-1 flex items-center justify-center">
            <BatteryShape level={0} color="var(--color-text-quaternary)" s={s} />
          </div>
          <div className="flex items-center justify-center w-full" style={{ marginTop: s(2), gap: s(6) }}>
            {SLEEP_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => handleMorningSet(opt.startEnergy)}
                className="flex flex-col items-center press-feedback rounded-[var(--radius-8)] transition-all hover:bg-[var(--color-bg-tertiary)] active:scale-90"
                style={{ padding: `${s(4)}px ${s(6)}px` }}
              >
                <span style={{ fontSize: s(20), lineHeight: 1 }}>{opt.emoji}</span>
                <span className="tabular-nums" style={{ fontSize: s(9), color: "var(--color-text-quaternary)", marginTop: s(1) }}>
                  {opt.startEnergy}%
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Active View ── */
        <>
          {/* Header: title + reset + percentage */}
          <div className="flex items-center shrink-0" style={{ marginBottom: s(2), gap: s(2), paddingInline: s(4) }}>
            <span className="flex-1 truncate" style={{ fontSize: s(13), fontWeight: 700, color, lineHeight: 1 }}>
              {title}
            </span>
            <button
              onClick={handleReset}
              className="flex items-center justify-center shrink-0 press-feedback rounded-full transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ width: s(18), height: s(18), color: "var(--color-text-quaternary)" }}
              aria-label="Reset"
            >
              <RotateCcw size={s(10)} />
            </button>
            <span className="tabular-nums shrink-0" style={{ fontSize: s(13), color, fontWeight: 700 }}>
              {currentEnergy}%
            </span>
          </div>

          {/* Battery hero + flash */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 relative">
            {rechargeFlash && (
              <div
                className="absolute top-0 right-0 font-bold tabular-nums z-10"
                style={{ fontSize: s(13), color: "var(--color-success)", animation: "energyFlash 1.5s ease forwards" }}
              >
                {rechargeFlash}
              </div>
            )}
            <BatteryShape level={currentEnergy} color={color} s={s} />

            <div className="flex items-center justify-center" style={{ marginTop: s(3) }}>
              {currentEnergy <= 20 && currentEnergy > 0 ? (
                <span className="rounded-[var(--radius-4)]" style={{ fontSize: s(9), paddingInline: s(6), paddingBlock: s(1), background: "var(--color-danger-tint)", color: "var(--color-danger)", fontWeight: 500 }}>
                  {t("widgets.energy.lowWarn" as any)}
                </span>
              ) : (
                <span className="tabular-nums" style={{ fontSize: s(9), color: "var(--color-text-quaternary)" }}>
                  {t("widgets.energy.awake" as any)} {Math.floor(hoursSinceWake)}h{Math.round((hoursSinceWake % 1) * 60).toString().padStart(2, "0")}m
                </span>
              )}
            </div>
          </div>

          {/* Bottom action area */}
          <div style={{ marginTop: s(2) }}>
            {!showRecharge ? (
              <button
                onClick={() => setShowRecharge(true)}
                className="w-full flex items-center justify-center press-feedback rounded-[var(--radius-8)] active:scale-[0.97] transition-transform"
                style={{ padding: `${s(5)}px 0`, fontSize: s(10), fontWeight: 600, background: "var(--color-accent-tint)", color: "var(--color-accent)", gap: s(4) }}
              >
                <Zap size={s(11)} />
                {t("widgets.energy.recharge" as any)}
              </button>
            ) : (
              <div style={{ animation: "energyFadeIn 0.2s ease" }}>
                <div className="flex items-center justify-center" style={{ gap: s(4) }}>
                  {RECHARGE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => handleRecharge(opt.key, opt.amount)}
                        className="flex-1 flex flex-col items-center press-feedback rounded-[var(--radius-8)] transition-all hover:bg-[var(--color-bg-tertiary)] active:scale-90"
                        style={{ padding: `${s(3)}px ${s(2)}px` }}
                      >
                        <Icon size={s(14)} style={{ color: "var(--color-success)" }} />
                        <span className="tabular-nums" style={{ fontSize: s(8), fontWeight: 600, color: "var(--color-success)", marginTop: s(1) }}>
                          +{opt.amount}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowRecharge(false)}
                  className="w-full press-feedback"
                  style={{ fontSize: s(9), color: "var(--color-text-quaternary)", marginTop: s(1), textAlign: "center" }}
                >
                  {t("widgets.energy.cancel" as any)}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes energyFlash {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-16px); }
        }
        @keyframes energyFadeIn {
          from { transform: translateY(4px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

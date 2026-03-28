import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════
   Solo CEO — Pixel Retro Game Edition (全模块预览)
   8-bit 像素复古风格，所有模块全面游戏化改造
   ═══════════════════════════════════════════════════════════════════ */

// ── Pixel font via Google Fonts CDN ──
const PIXEL_FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap');
`;

// ── 8-bit Color Palette ──
const C = {
  bg: "#1a1a2e",
  bgCard: "#16213e",
  bgPanel: "#0f3460",
  accent: "#e94560",
  gold: "#f5c842",
  xp: "#53d769",
  blue: "#4fc3f7",
  purple: "#bb86fc",
  cyan: "#00e5ff",
  white: "#e8e8e8",
  muted: "#7a8ba6",
  dark: "#0a0a1a",
  hp: "#e94560",
  mp: "#4fc3f7",
  border: "#2a3a5e",
  success: "#53d769",
  warning: "#f5c842",
  danger: "#e94560",
};

// ── Pixel border style ──
const pixelBorder = (color = C.border) => ({
  border: `2px solid ${color}`,
  boxShadow: `4px 4px 0px ${C.dark}, inset 1px 1px 0px rgba(255,255,255,0.1)`,
});

const pixelBtn = (bg = C.accent) => ({
  ...pixelBorder(bg),
  background: bg,
  color: "#fff",
  fontFamily: "'Press Start 2P', cursive",
  fontSize: "8px",
  padding: "8px 12px",
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "1px",
  transition: "all 0.1s",
});

// ── Mock Data ──
const PLAYER = {
  name: "Andy",
  title: "独立创业者",
  level: 12,
  xp: 2450,
  xpNext: 3000,
  hp: 85,
  mp: 60,
  gold: 15280,
  streak: 7,
  achievements: 24,
};

const QUESTS = [
  { id: 1, title: "完成Aegis Logo设计", client: "Aegis Corp", xp: 150, gold: 500, priority: "S", status: "进行中", hp: 40, maxHp: 100 },
  { id: 2, title: "发送项目提案给新客户", client: "TechStart", xp: 80, gold: 200, priority: "A", status: "待接取", hp: 100, maxHp: 100 },
  { id: 3, title: "更新Solo CEO产品文档", client: "内部", xp: 120, gold: 0, priority: "A", status: "进行中", hp: 65, maxHp: 100 },
  { id: 4, title: "修复支付模块Bug", client: "Platform", xp: 200, gold: 800, priority: "S", status: "待接取", hp: 100, maxHp: 100 },
  { id: 5, title: "设计新Landing Page", client: "Aegis Corp", xp: 100, gold: 350, priority: "B", status: "审核中", hp: 10, maxHp: 100 },
  { id: 6, title: "准备季度财报", client: "内部", xp: 180, gold: 0, priority: "A", status: "已完成", hp: 0, maxHp: 100 },
];

const PERSONAL_QUESTS = [
  { id: 101, title: "跑步5公里", xp: 30, type: "体力", done: true },
  { id: 102, title: "读书30分钟", xp: 20, type: "智力", done: false },
  { id: 103, title: "整理工作台", xp: 15, type: "环境", done: false },
  { id: 104, title: "冥想10分钟", xp: 25, type: "精神", done: true },
];

const SCOUTS = [
  { name: "CloudBase Inc", industry: "SaaS", quality: "S", stage: "已接触", needs: "品牌重塑" },
  { name: "FoodRush", industry: "外卖", quality: "A", stage: "新发现", needs: "App设计" },
  { name: "EduPlus", industry: "教育", quality: "B", stage: "提案中", needs: "官网建设" },
  { name: "GreenTech", industry: "环保", quality: "A", stage: "已接触", needs: "产品设计" },
  { name: "FinEdge", industry: "金融", quality: "S", stage: "新发现", needs: "Dashboard" },
];

const ALLIES = [
  { name: "Aegis Corp", type: "订阅制", mrr: 3200, health: 92, since: "2025-01" },
  { name: "TechStart", type: "项目制", mrr: 0, paid: 8500, health: 78, since: "2025-06" },
  { name: "Platform X", type: "订阅制", mrr: 1800, health: 95, since: "2024-11" },
  { name: "DataFlow", type: "项目制", mrr: 0, paid: 12000, health: 60, since: "2025-03" },
];

const TREASURY = [
  { date: "03-28", desc: "Aegis Corp 月费", amount: 3200, type: "income", cat: "订阅收入" },
  { date: "03-27", desc: "Figma 订阅", amount: -15, type: "expense", cat: "软件支出" },
  { date: "03-26", desc: "TechStart 项目款", amount: 4250, type: "income", cat: "项目收入" },
  { date: "03-25", desc: "外包设计师", amount: -800, type: "expense", cat: "外包支出" },
  { date: "03-25", desc: "午餐", amount: -35, type: "personal", cat: "餐饮" },
  { date: "03-24", desc: "Platform X 月费", amount: 1800, type: "income", cat: "订阅收入" },
];

const ACHIEVEMENTS = [
  { icon: "🏆", name: "首单告捷", desc: "签下第一个客户", unlocked: true },
  { icon: "🔥", name: "七日连击", desc: "连续7天完成所有每日任务", unlocked: true },
  { icon: "💰", name: "万金之主", desc: "累计收入突破$10,000", unlocked: true },
  { icon: "⚔️", name: "任务猎人", desc: "完成100个任务", unlocked: true },
  { icon: "🛡️", name: "零逾期", desc: "连续30天无逾期任务", unlocked: false },
  { icon: "🌟", name: "五星好评", desc: "获得5个客户好评", unlocked: false },
  { icon: "👑", name: "月入万元", desc: "单月收入突破$10,000", unlocked: false },
  { icon: "🐉", name: "屠龙勇者", desc: "完成一个S级超级任务", unlocked: true },
];

const DAILY_PROTOCOL = [
  { step: "晨间复盘", done: true, icon: "☀️" },
  { step: "设定今日目标", done: true, icon: "🎯" },
  { step: "处理紧急任务", done: true, icon: "⚡" },
  { step: "深度工作2h", done: false, icon: "🔨" },
  { step: "客户沟通", done: false, icon: "💬" },
  { step: "财务检查", done: false, icon: "💎" },
  { step: "晚间总结", done: false, icon: "🌙" },
];

// ── Pixel Art Components ──

function PixelHeart({ filled = true, size = 12 }) {
  return (
    <span style={{ fontSize: size, lineHeight: 1, filter: filled ? "none" : "grayscale(1) opacity(0.3)" }}>
      ❤️
    </span>
  );
}

function PixelBar({ value, max, color, width = 120, height = 10, label }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {label && <span style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted, minWidth: 20 }}>{label}</span>}
      <div style={{ width, height, background: C.dark, border: `1px solid ${C.border}`, position: "relative", imageRendering: "pixelated" }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: color,
          boxShadow: `inset 0 -2px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)`,
          transition: "width 0.5s ease",
        }} />
      </div>
      <span style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color }}>{value}/{max}</span>
    </div>
  );
}

function XPBar({ xp, xpNext, level }) {
  const pct = (xp / xpNext) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <div style={{
        ...pixelBorder(C.gold),
        background: C.dark,
        width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Press Start 2P'", fontSize: 10, color: C.gold, flexShrink: 0,
      }}>
        {level}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.xp }}>EXP</span>
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted }}>{xp}/{xpNext}</span>
        </div>
        <div style={{ width: "100%", height: 8, background: C.dark, border: `1px solid ${C.border}` }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: `linear-gradient(90deg, ${C.xp}, #a8e063)`,
            boxShadow: `inset 0 -2px 0 rgba(0,0,0,0.3)`,
            transition: "width 0.8s ease",
          }} />
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const colors = { S: C.danger, A: C.gold, B: C.blue, C: C.muted };
  return (
    <span style={{
      ...pixelBorder(colors[priority] || C.muted),
      background: colors[priority] || C.muted,
      fontFamily: "'Press Start 2P'", fontSize: 8, color: "#fff",
      padding: "2px 6px", display: "inline-block",
    }}>
      {priority}
    </span>
  );
}

function QuestStatusBadge({ status }) {
  const map = {
    "待接取": { bg: C.muted, label: "NEW" },
    "进行中": { bg: C.blue, label: "ACTIVE" },
    "审核中": { bg: C.warning, label: "REVIEW" },
    "已完成": { bg: C.success, label: "CLEAR!" },
  };
  const s = map[status] || map["待接取"];
  return (
    <span style={{
      fontFamily: "'Press Start 2P'", fontSize: 7, color: "#fff",
      background: s.bg, padding: "2px 6px", border: `1px solid rgba(255,255,255,0.2)`,
    }}>
      {s.label}
    </span>
  );
}

function GoldDisplay({ amount }) {
  return (
    <span style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: C.gold, display: "inline-flex", alignItems: "center", gap: 3 }}>
      💰 {typeof amount === "number" ? amount.toLocaleString() : amount}G
    </span>
  );
}

function StreakFire({ days }) {
  return (
    <div style={{
      ...pixelBorder(C.accent),
      background: `linear-gradient(135deg, ${C.accent}33, ${C.dark})`,
      padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      <span style={{ fontSize: 16 }}>🔥</span>
      <div>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: C.accent }}>{days}</div>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 6, color: C.muted }}>COMBO</div>
      </div>
    </div>
  );
}

// ── Page Components ──

function HQPage() {
  const [protocolSteps, setProtocol] = useState(DAILY_PROTOCOL);

  const toggleStep = (i) => {
    setProtocol(prev => prev.map((s, idx) => idx === i ? { ...s, done: !s.done } : s));
  };

  const protocolDone = protocolSteps.filter(s => s.done).length;
  const protocolTotal = protocolSteps.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Player Status Bar */}
      <div style={{ ...pixelBorder(), background: C.bgCard, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 12, color: C.gold, marginBottom: 4 }}>
              ⚔️ {PLAYER.name}
            </div>
            <div style={{ fontFamily: "'Noto Sans SC'", fontSize: 11, color: C.muted }}>{PLAYER.title}</div>
          </div>
          <StreakFire days={PLAYER.streak} />
        </div>
        <XPBar xp={PLAYER.xp} xpNext={PLAYER.xpNext} level={PLAYER.level} />
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <PixelBar value={PLAYER.hp} max={100} color={C.hp} width={100} height={8} label="HP" />
          <PixelBar value={PLAYER.mp} max={100} color={C.mp} width={100} height={8} label="MP" />
        </div>
      </div>

      {/* KPI Grid — Game Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { icon: "💰", label: "MRR", value: "$5,000", sub: "月度订阅" },
          { icon: "📊", label: "年度收入", value: "$42,800", sub: "+$3,200 今日" },
          { icon: "🤝", label: "同盟", value: "4", sub: "+5 侦察中" },
          { icon: "⚔️", label: "任务", value: "6", sub: "3 进行中" },
        ].map(s => (
          <div key={s.label} style={{
            ...pixelBorder(), background: C.bgCard, padding: "10px 12px",
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 12, color: C.white }}>{s.value}</div>
            <div style={{ fontFamily: "'Noto Sans SC'", fontSize: 10, color: C.xp, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Monthly Goal — Boss Battle Progress */}
      <div style={{ ...pixelBorder(C.gold), background: `linear-gradient(135deg, ${C.bgCard}, #2a1a00)`, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: C.gold }}>🐉 月度BOSS战</span>
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: C.muted }}>$8,000 目标</span>
        </div>
        <div style={{ width: "100%", height: 16, background: C.dark, border: `2px solid ${C.gold}`, position: "relative" }}>
          <div style={{
            width: "63%", height: "100%",
            background: `linear-gradient(90deg, ${C.danger}, ${C.gold})`,
            boxShadow: `inset 0 -3px 0 rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.2)`,
          }} />
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            fontFamily: "'Press Start 2P'", fontSize: 8, color: "#fff", textShadow: "1px 1px 0 #000",
          }}>
            $5,040 / $8,000
          </div>
        </div>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.xp, marginTop: 4, textAlign: "right" }}>
          63% — 继续战斗！
        </div>
      </div>

      {/* Daily Protocol — Quest Chain */}
      <div style={{ ...pixelBorder(), background: C.bgCard, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: C.cyan }}>📜 每日协议</span>
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: protocolDone === protocolTotal ? C.xp : C.muted }}>
            {protocolDone}/{protocolTotal}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {protocolSteps.map((step, i) => (
            <div
              key={i}
              onClick={() => toggleStep(i)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                background: step.done ? `${C.xp}15` : "transparent",
                border: `1px solid ${step.done ? C.xp + "40" : C.border}`,
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 14 }}>{step.icon}</span>
              <span style={{
                fontFamily: "'Noto Sans SC'", fontSize: 12, color: step.done ? C.xp : C.white,
                textDecoration: step.done ? "line-through" : "none", flex: 1,
              }}>
                {step.step}
              </span>
              <span style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: step.done ? C.xp : C.muted }}>
                {step.done ? "✓" : `0${i + 1}`}
              </span>
            </div>
          ))}
        </div>
        {protocolDone === protocolTotal && (
          <div style={{
            marginTop: 8, padding: 8, background: `${C.gold}20`, border: `2px solid ${C.gold}`,
            textAlign: "center", fontFamily: "'Press Start 2P'", fontSize: 8, color: C.gold,
          }}>
            ✨ ALL CLEAR! +50 XP BONUS ✨
          </div>
        )}
      </div>

      {/* Today Focus — Daily Quests */}
      <div style={{ ...pixelBorder(), background: C.bgCard, padding: 12 }}>
        <span style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: C.accent, display: "block", marginBottom: 8 }}>
          🎯 今日重点任务
        </span>
        {[
          { title: "回复Aegis Corp邮件", type: "客户", done: false, xp: 20 },
          { title: "完成Logo初稿", type: "任务", done: false, xp: 50 },
          { title: "检查本月收支", type: "财务", done: true, xp: 15 },
        ].map((f, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", marginBottom: 4,
            background: f.done ? `${C.xp}10` : "transparent",
            border: `1px solid ${f.done ? C.xp + "30" : C.border}`,
          }}>
            <span style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: f.done ? C.xp : C.muted }}>
              {f.done ? "☑" : "☐"}
            </span>
            <span style={{
              fontFamily: "'Noto Sans SC'", fontSize: 12, color: f.done ? C.xp : C.white, flex: 1,
              textDecoration: f.done ? "line-through" : "none",
            }}>
              {f.title}
            </span>
            <span style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.purple }}>+{f.xp}XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestsPage() {
  const [tab, setTab] = useState("work");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Tab Switch */}
      <div style={{ display: "flex", gap: 0 }}>
        {[
          { id: "work", label: "⚔️ 工作副本", icon: "⚔️" },
          { id: "personal", label: "🏃 个人修炼", icon: "🏃" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            ...pixelBorder(tab === t.id ? C.accent : C.border),
            background: tab === t.id ? C.accent : C.bgCard,
            color: tab === t.id ? "#fff" : C.muted,
            fontFamily: "'Press Start 2P'", fontSize: 8, padding: "8px 14px",
            cursor: "pointer", flex: 1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "work" ? (
        <>
          {/* Quest List */}
          {QUESTS.map(q => (
            <div key={q.id} style={{
              ...pixelBorder(q.status === "已完成" ? C.xp : C.border),
              background: q.status === "已完成" ? `${C.xp}10` : C.bgCard,
              padding: 12, opacity: q.status === "已完成" ? 0.7 : 1,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <PriorityBadge priority={q.priority} />
                  <span style={{ fontFamily: "'Noto Sans SC'", fontSize: 13, color: C.white, fontWeight: 700 }}>
                    {q.title}
                  </span>
                </div>
                <QuestStatusBadge status={q.status} />
              </div>
              <div style={{ fontFamily: "'Noto Sans SC'", fontSize: 11, color: C.muted, marginBottom: 6 }}>
                📍 {q.client}
              </div>
              {/* Monster HP Bar */}
              <div style={{ marginBottom: 6 }}>
                <PixelBar
                  value={q.maxHp - q.hp}
                  max={q.maxHp}
                  color={q.status === "已完成" ? C.xp : C.accent}
                  width={200}
                  height={8}
                  label=""
                />
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 6, color: C.muted, marginTop: 2 }}>
                  进度 {q.maxHp - q.hp}%
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.purple }}>+{q.xp} XP</span>
                {q.gold > 0 && <GoldDisplay amount={q.gold} />}
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          {/* Personal Training */}
          <div style={{ ...pixelBorder(C.purple), background: `${C.purple}10`, padding: 10, marginBottom: 4 }}>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: C.purple, marginBottom: 4 }}>
              📊 今日修炼进度
            </div>
            <PixelBar
              value={PERSONAL_QUESTS.filter(q => q.done).length}
              max={PERSONAL_QUESTS.length}
              color={C.purple}
              width={200}
              height={10}
            />
          </div>
          {PERSONAL_QUESTS.map(q => (
            <div key={q.id} style={{
              ...pixelBorder(q.done ? C.xp : C.border),
              background: q.done ? `${C.xp}10` : C.bgCard,
              padding: "10px 12px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>{q.done ? "✅" : "⬜"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Noto Sans SC'", fontSize: 13, color: q.done ? C.xp : C.white }}>
                  {q.title}
                </div>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted }}>{q.type}</div>
              </div>
              <span style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: C.purple }}>+{q.xp}XP</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function ScoutsPage() {
  const qualityColors = { S: C.danger, A: C.gold, B: C.blue, C: C.muted };
  const stageColors = { "新发现": C.muted, "已接触": C.blue, "提案中": C.warning, "已签约": C.xp, "失败": C.danger };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Funnel Overview */}
      <div style={{ ...pixelBorder(), background: C.bgCard, padding: 12 }}>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: C.cyan, marginBottom: 10 }}>
          🗺️ 侦察漏斗
        </div>
        {[
          { stage: "新发现", count: 2, width: "100%", color: C.muted },
          { stage: "已接触", count: 2, width: "75%", color: C.blue },
          { stage: "提案中", count: 1, width: "45%", color: C.warning },
          { stage: "已签约", count: 0, width: "20%", color: C.xp },
        ].map(s => (
          <div key={s.stage} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontFamily: "'Noto Sans SC'", fontSize: 11, color: s.color }}>{s.stage}</span>
              <span style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: s.color }}>{s.count}</span>
            </div>
            <div style={{ width: "100%", height: 8, background: C.dark, border: `1px solid ${C.border}` }}>
              <div style={{ width: s.width, height: "100%", background: s.color, transition: "width 0.5s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Scout Cards */}
      {SCOUTS.map((s, i) => (
        <div key={i} style={{ ...pixelBorder(), background: C.bgCard, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                ...pixelBorder(qualityColors[s.quality]),
                background: qualityColors[s.quality],
                fontFamily: "'Press Start 2P'", fontSize: 8, color: "#fff",
                padding: "2px 6px",
              }}>{s.quality}</span>
              <span style={{ fontFamily: "'Noto Sans SC'", fontSize: 13, color: C.white, fontWeight: 700 }}>{s.name}</span>
            </div>
            <span style={{
              fontFamily: "'Press Start 2P'", fontSize: 7,
              color: stageColors[s.stage] || C.muted,
              border: `1px solid ${stageColors[s.stage] || C.border}`,
              padding: "2px 6px",
            }}>{s.stage}</span>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ fontFamily: "'Noto Sans SC'", fontSize: 11, color: C.muted }}>🏢 {s.industry}</span>
            <span style={{ fontFamily: "'Noto Sans SC'", fontSize: 11, color: C.muted }}>📋 {s.needs}</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button style={{ ...pixelBtn(C.blue), fontSize: 7, padding: "4px 8px" }}>📧 发送开发信</button>
            <button style={{ ...pixelBtn(C.purple), fontSize: 7, padding: "4px 8px" }}>🔍 AI分析</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AlliesPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...pixelBorder(C.gold), background: `${C.gold}10`, padding: 10 }}>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: C.gold }}>
          🤝 同盟总览
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <div>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 14, color: C.white }}>4</div>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted }}>ALLIES</div>
          </div>
          <div>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 14, color: C.gold }}>$5,000</div>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted }}>MRR</div>
          </div>
        </div>
      </div>

      {ALLIES.map((a, i) => (
        <div key={i} style={{ ...pixelBorder(), background: C.bgCard, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div>
              <div style={{ fontFamily: "'Noto Sans SC'", fontSize: 14, color: C.white, fontWeight: 700 }}>{a.name}</div>
              <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted }}>{a.type} · since {a.since}</div>
            </div>
            {a.mrr > 0 && <GoldDisplay amount={a.mrr} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted }}>友好度</span>
            <PixelBar value={a.health} max={100} color={a.health > 80 ? C.xp : a.health > 50 ? C.warning : C.danger} width={120} height={8} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TreasuryPage() {
  const [tab, setTab] = useState("biz");
  const income = TREASURY.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = TREASURY.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Treasury Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={{ ...pixelBorder(C.xp), background: C.bgCard, padding: 10, textAlign: "center" }}>
          <div style={{ fontSize: 16, marginBottom: 2 }}>💎</div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted, marginBottom: 2 }}>收入</div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: C.xp }}>+${income.toLocaleString()}</div>
        </div>
        <div style={{ ...pixelBorder(C.danger), background: C.bgCard, padding: 10, textAlign: "center" }}>
          <div style={{ fontSize: 16, marginBottom: 2 }}>🔥</div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted, marginBottom: 2 }}>支出</div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: C.danger }}>${Math.abs(expense).toLocaleString()}</div>
        </div>
        <div style={{ ...pixelBorder(C.gold), background: C.bgCard, padding: 10, textAlign: "center" }}>
          <div style={{ fontSize: 16, marginBottom: 2 }}>💰</div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted, marginBottom: 2 }}>净利</div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: C.gold }}>${(income + expense).toLocaleString()}</div>
        </div>
      </div>

      {/* Tab Switch */}
      <div style={{ display: "flex", gap: 0 }}>
        {[
          { id: "biz", label: "🏢 公司金库" },
          { id: "personal", label: "👤 个人钱包" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            ...pixelBorder(tab === t.id ? C.gold : C.border),
            background: tab === t.id ? `${C.gold}30` : C.bgCard,
            color: tab === t.id ? C.gold : C.muted,
            fontFamily: "'Press Start 2P'", fontSize: 8, padding: "8px 14px",
            cursor: "pointer", flex: 1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* AI Input */}
      <div style={{ ...pixelBorder(C.purple), background: C.bgCard, padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>🤖</span>
        <input
          placeholder="说出交易内容... 如: 午餐花了35"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontFamily: "'Noto Sans SC'", fontSize: 12, color: C.white,
          }}
        />
        <button style={{ ...pixelBtn(C.purple), padding: "4px 8px" }}>⚡</button>
      </div>

      {/* Transaction Log */}
      <div style={{ ...pixelBorder(), background: C.bgCard, padding: 0 }}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: C.gold }}>📜 交易记录</span>
        </div>
        {TREASURY.filter(t => tab === "biz" ? t.type !== "personal" : t.type === "personal").map((tx, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", padding: "8px 12px",
            borderBottom: `1px solid ${C.border}20`,
          }}>
            <span style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: C.muted, width: 48 }}>{tx.date}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Noto Sans SC'", fontSize: 12, color: C.white }}>{tx.desc}</div>
              <div style={{ fontFamily: "'Press Start 2P'", fontSize: 6, color: C.muted }}>{tx.cat}</div>
            </div>
            <span style={{
              fontFamily: "'Press Start 2P'", fontSize: 9,
              color: tx.amount > 0 ? C.xp : C.danger,
            }}>
              {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}G
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AchievementsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...pixelBorder(C.gold), background: `${C.gold}10`, padding: 10, textAlign: "center" }}>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: C.gold }}>
          🏆 成就殿堂
        </div>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: C.muted, marginTop: 4 }}>
          {ACHIEVEMENTS.filter(a => a.unlocked).length} / {ACHIEVEMENTS.length} 已解锁
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {ACHIEVEMENTS.map((a, i) => (
          <div key={i} style={{
            ...pixelBorder(a.unlocked ? C.gold : C.border),
            background: a.unlocked ? C.bgCard : `${C.dark}`,
            padding: 12, textAlign: "center",
            opacity: a.unlocked ? 1 : 0.5,
            filter: a.unlocked ? "none" : "grayscale(0.8)",
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{a.unlocked ? a.icon : "🔒"}</div>
            <div style={{ fontFamily: "'Noto Sans SC'", fontSize: 12, color: a.unlocked ? C.gold : C.muted, fontWeight: 700 }}>
              {a.name}
            </div>
            <div style={{ fontFamily: "'Noto Sans SC'", fontSize: 10, color: C.muted, marginTop: 2 }}>
              {a.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main App ──

const TABS = [
  { id: "hq", label: "总部", icon: "🏰", component: HQPage },
  { id: "quests", label: "任务", icon: "⚔️", component: QuestsPage },
  { id: "scouts", label: "侦察", icon: "🗺️", component: ScoutsPage },
  { id: "allies", label: "同盟", icon: "🤝", component: AlliesPage },
  { id: "treasury", label: "金库", icon: "💰", component: TreasuryPage },
  { id: "achievements", label: "成就", icon: "🏆", component: AchievementsPage },
];

export default function SoloCEOPixelGame() {
  const [activeTab, setActiveTab] = useState("hq");
  const [showNotif, setShowNotif] = useState(true);
  const ActivePage = TABS.find(t => t.id === activeTab)?.component || HQPage;

  useEffect(() => {
    if (showNotif) {
      const timer = setTimeout(() => setShowNotif(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showNotif]);

  return (
    <div style={{
      fontFamily: "'Noto Sans SC', sans-serif",
      background: C.bg,
      minHeight: "100vh",
      maxWidth: 480,
      margin: "0 auto",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{PIXEL_FONT_CSS}</style>

      {/* Top Bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: C.dark,
        borderBottom: `2px solid ${C.border}`,
        padding: "8px 12px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>👾</span>
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: C.gold }}>SOLO CEO</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <GoldDisplay amount={PLAYER.gold} />
          <div style={{
            ...pixelBorder(C.gold), width: 24, height: 24,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Press Start 2P'", fontSize: 9, color: C.gold, background: C.dark,
          }}>
            {PLAYER.level}
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {showNotif && (
        <div style={{
          position: "absolute", top: 48, left: 12, right: 12, zIndex: 200,
          ...pixelBorder(C.xp),
          background: `${C.bgCard}f0`,
          padding: "10px 12px",
          display: "flex", alignItems: "center", gap: 8,
          animation: "slideDown 0.3s ease",
        }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: C.xp }}>QUEST COMPLETE!</div>
            <div style={{ fontFamily: "'Noto Sans SC'", fontSize: 11, color: C.white }}>准备季度财报 → +180 XP</div>
          </div>
          <button onClick={() => setShowNotif(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Page Content */}
      <div style={{ padding: "12px 12px 80px 12px" }}>
        <ActivePage />
      </div>

      {/* Bottom Nav — Game Style */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480,
        background: C.dark,
        borderTop: `2px solid ${C.border}`,
        display: "flex",
        zIndex: 100,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: "8px 4px",
              background: activeTab === tab.id ? `${C.accent}30` : "transparent",
              borderTop: activeTab === tab.id ? `2px solid ${C.accent}` : "2px solid transparent",
              border: "none",
              cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 16, filter: activeTab === tab.id ? "none" : "grayscale(0.6)" }}>
              {tab.icon}
            </span>
            <span style={{
              fontFamily: "'Press Start 2P'", fontSize: 6,
              color: activeTab === tab.id ? C.accent : C.muted,
            }}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.dark}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; }
        input::placeholder { color: ${C.muted}; }
      `}</style>
    </div>
  );
}

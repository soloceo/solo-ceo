export interface ProtocolStep {
  id: string;
  time: { zh: string; en: string };
  title: { zh: string; en: string };
  description: { zh: string; en: string };
  timeRange?: [number, number];
}

export const PROTOCOL_STEPS: ProtocolStep[] = [
  {
    id: "sleep-check",
    time: { zh: "起床", en: "Wake-up" },
    title: { zh: "睡眠检查", en: "Sleep Check" },
    description: { zh: "昨晚睡了几小时？睡眠质量如何？精力是否充沛？", en: "How many hours did you sleep? How was the quality? Do you feel energized?" },
    timeRange: [5, 8],
  },
  {
    id: "morning-review",
    time: { zh: "晨间", en: "Morning" },
    title: { zh: "回顾原则", en: "Review Principles" },
    description: { zh: "花5分钟回顾你正在实践的2-3个核心原则，设定今天的行为锚点。", en: "Spend 5 minutes reviewing 2-3 core principles you're practicing, set today's behavioral anchors." },
    timeRange: [8, 9],
  },
  {
    id: "top3",
    time: { zh: "上午", en: "AM" },
    title: { zh: "设定TOP 3任务", en: "Set TOP 3 Tasks" },
    description: { zh: "确定今天最重要的3件事。至少1件是'推动飞轮'的行动（如发内容、发开发信、完成案例）。", en: "Identify today's top 3 priorities. At least 1 must be a 'flywheel push' action (post content, send outreach, complete a case study)." },
    timeRange: [9, 12],
  },
  {
    id: "noon-check",
    time: { zh: "午间", en: "Noon" },
    title: { zh: "能量检查", en: "Energy Check" },
    description: { zh: "检查精力状态：如果电量低于50%，先休息15分钟再继续。调整下午的任务优先级。", en: "Check energy level: if below 50%, rest 15 minutes first. Adjust afternoon task priorities." },
    timeRange: [12, 14],
  },
  {
    id: "evening-signal",
    time: { zh: "傍晚", en: "Evening" },
    title: { zh: "发射信号", en: "Emit Signal" },
    description: { zh: "确保今天至少发射了1个信号：LinkedIn帖子、开发邮件、社媒更新、或参加社交活动。", en: "Ensure at least 1 signal was emitted today: LinkedIn post, outreach email, social media update, or attending a networking event." },
    timeRange: [14, 18],
  },
  {
    id: "exercise-check",
    time: { zh: "晚间", en: "PM" },
    title: { zh: "运动打卡", en: "Exercise Check" },
    description: { zh: "今天身体动了吗？散步、跑步、健身，任何形式都算。", en: "Did you move your body today? Walking, running, gym — anything counts." },
    timeRange: [18, 21],
  },
  {
    id: "night-review",
    time: { zh: "睡前", en: "Night" },
    title: { zh: "复盘总结", en: "Daily Review" },
    description: { zh: "3个问题：今天推动了飞轮吗？有什么可以转化为燃料的挫折？明天的TOP 1是什么？", en: "3 questions: Did I push the flywheel today? Any setbacks to convert to fuel? What's tomorrow's TOP 1?" },
    timeRange: [21, 24],
  },
];

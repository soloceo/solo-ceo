export interface ProtocolStep {
  id: string;
  time: { zh: string; en: string };
  title: { zh: string; en: string };
  description: { zh: string; en: string };
  timeRange?: [number, number];
}

export const PROTOCOL_STEPS: ProtocolStep[] = [
  {
    id: "hydrate-light",
    time: { zh: "起床", en: "Wake-Up" },
    title: { zh: "晨光补水", en: "Hydrate & Light Exposure" },
    description: { zh: "起床后立刻喝一杯水（300-500ml），然后到窗边或户外接受10分钟自然光，重置昼夜节律。", en: "Drink a full glass of water (300-500ml) immediately after waking, then get 10 minutes of natural sunlight to reset your circadian rhythm." },
    timeRange: [5, 8],
  },
  {
    id: "deep-work",
    time: { zh: "上午", en: "Morning" },
    title: { zh: "深度工作时段", en: "Deep Work Block" },
    description: { zh: "利用皮质醇高峰期进行最重要的创造性工作。手机静音，关闭通知，每90分钟休息一次。", en: "Use your cortisol peak for your most important creative work. Silence notifications and take a break every 90 minutes." },
    timeRange: [8, 12],
  },
  {
    id: "move-eat",
    time: { zh: "中午", en: "Midday" },
    title: { zh: "午间运动与进食", en: "Move & Eat" },
    description: { zh: "先进行20-30分钟中等强度运动（快走、拉伸或力量训练），然后吃一顿富含蛋白质和蔬菜的午餐，避免午后困倦。", en: "Do 20-30 minutes of moderate exercise (brisk walk, stretching, or strength training), then eat a protein-rich lunch to avoid an afternoon energy crash." },
    timeRange: [12, 13],
  },
  {
    id: "power-nap",
    time: { zh: "午后", en: "Early PM" },
    title: { zh: "短暂休息或小睡", en: "Rest or Power Nap" },
    description: { zh: "闭眼休息10-20分钟（不超过20分钟）。即使不入睡，安静休息也能恢复注意力和工作记忆。", en: "Close your eyes for 10-20 minutes (no longer than 20). Even quiet rest without sleep restores attention and working memory." },
    timeRange: [13, 14],
  },
  {
    id: "execute-communicate",
    time: { zh: "下午", en: "Afternoon" },
    title: { zh: "执行与沟通时段", en: "Execution & Communication" },
    description: { zh: "处理邮件、会议、行政事务等必要工作。每隔一小时站起来活动2-3分钟，补充饮水。", en: "Handle emails, meetings, and admin tasks. Stand up and move for 2-3 minutes every hour and keep hydrating." },
    timeRange: [14, 18],
  },
  {
    id: "disconnect-move",
    time: { zh: "傍晚", en: "Evening" },
    title: { zh: "断开工作·身体活动", en: "Disconnect & Move" },
    description: { zh: "明确结束工作（关闭电脑/工作App）。进行30分钟户外散步或轻度运动，从工作模式切换到休息模式。", en: "Formally end your workday (close laptop/work apps). Take a 30-minute outdoor walk or light exercise to transition to rest mode." },
    timeRange: [18, 21],
  },
  {
    id: "screens-off",
    time: { zh: "睡前", en: "Wind-Down" },
    title: { zh: "屏幕断电·助眠准备", en: "Screens Off & Sleep Prep" },
    description: { zh: "睡前60分钟停止使用屏幕。调暗灯光，阅读纸质书、写日记或做简单拉伸。保持固定就寝时间，目标睡眠7-8小时。", en: "Stop all screens 60 minutes before bed. Dim the lights, read a physical book, journal, or do light stretching. Aim for 7-8 hours of sleep." },
    timeRange: [21, 24],
  },
];

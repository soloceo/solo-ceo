export type Freq = "daily" | "weekly" | "once";

export interface BTask {
  id: string;
  title: { zh: string; en: string };
  freq: Freq;
}

export interface Phase {
  id: string;
  label: { zh: string; en: string };
  weeks: { zh: string; en: string };
  strategy: { emoji: string; title: { zh: string; en: string }; content: { zh: string; en: string } };
  tasks: BTask[];
}

export const PHASES: Phase[] = [
  {
    id: "phase1",
    label: { zh: "造弹药", en: "Build Arsenal" },
    weeks: { zh: "第1-2周", en: "Week 1-2" },
    strategy: {
      emoji: "⚡",
      title: { zh: "核心策略：造弹药", en: "Core Strategy: Build Arsenal" },
      content: {
        zh: "你没有旧作品可用，但你有大师级的速度和判断力。用概念项目（Concept Redesign）快速建立作品集——这在设计行业是完全被认可的。选择真实品牌，做未经授权的重设计，展示你的思考过程和执行力。同时找 2-3 个小企业做换作品合作，快速获得真实案例。",
        en: "You don't have old work to show, but you have master-level speed and judgment. Use concept projects (Concept Redesigns) to rapidly build a portfolio — this is fully recognized in the design industry. Choose real brands, do unsolicited redesigns, showcase your thinking process and execution. Find 2-3 small businesses for portfolio exchanges to quickly get real case studies.",
      },
    },
    tasks: [
      { id: "p1-concept", title: { zh: "做概念重设计案例（选3-5个行业常见品牌做Before/After）", en: "Create concept redesign cases (3-5 Before/After for common industries)" }, freq: "once" },
      { id: "p1-collab", title: { zh: "找小企业换作品合作（主动提出免费/低价换案例）", en: "Find small businesses for portfolio exchange (offer free/low-cost for case studies)" }, freq: "weekly" },
      { id: "p1-beforeafter", title: { zh: "做Before/After改造展示", en: "Create Before/After transformation showcases" }, freq: "weekly" },
      { id: "p1-senior", title: { zh: "投Senior级合同岗位", en: "Apply for senior contract positions" }, freq: "weekly" },
      { id: "p1-upwork", title: { zh: "Upwork高预算投标（$2000+项目）", en: "Bid on Upwork high-budget projects ($2000+)" }, freq: "weekly" },
      { id: "p1-portfolio", title: { zh: "搭建作品集网站（展示订阅制服务模式）", en: "Build portfolio website (showcase subscription service model)" }, freq: "once" },
      { id: "p1-ontario", title: { zh: "申请Ontario Works / 本地补助", en: "Apply for Ontario Works / local grants" }, freq: "once" },
      { id: "p1-case", title: { zh: "每周产出至少1个完整案例", en: "Produce at least 1 complete case study per week" }, freq: "weekly" },
    ],
  },
  {
    id: "phase2",
    label: { zh: "破隐身", en: "Break Stealth" },
    weeks: { zh: "第3-6周", en: "Week 3-6" },
    strategy: {
      emoji: "📡",
      title: { zh: "核心策略：破隐身", en: "Core Strategy: Break Stealth" },
      content: {
        zh: "你被雪藏了 10 年——这本身就是一个好故事。「大师出山」的叙事比「又一个设计师」有趣 100 倍。在 LinkedIn 上讲你的设计思考方式，做「品牌急诊室」系列公开点评——让人们看到你怎么想问题，而不只是你能画什么。展示判断力比展示作品更重要。",
        en: "You've been hidden for 10 years — that's a great story in itself. The 'master emerges' narrative is 100x more interesting than 'yet another designer.' Share your design thinking on LinkedIn, create a 'Brand ER' series of public critiques — let people see how you think, not just what you can draw. Demonstrating judgment matters more than showing work.",
      },
    },
    tasks: [
      { id: "p2-linkedin", title: { zh: "LinkedIn日更（设计洞察/案例/行业观察）", en: "Daily LinkedIn posts (design insights/cases/industry observations)" }, freq: "daily" },
      { id: "p2-clinic", title: { zh: "品牌急诊室系列：每周免费诊断1个品牌", en: "Brand Clinic series: free brand diagnosis 1x per week" }, freq: "weekly" },
      { id: "p2-community", title: { zh: "加入本地商业社群（BNI/Chamber of Commerce）", en: "Join local business communities (BNI/Chamber of Commerce)" }, freq: "once" },
      { id: "p2-network", title: { zh: "参加networking活动（每周至少1次）", en: "Attend networking events (at least 1x per week)" }, freq: "weekly" },
      { id: "p2-xiaohongshu", title: { zh: "小红书/微信发内容（华人市场触达）", en: "Post on Xiaohongshu/WeChat (Chinese market reach)" }, freq: "daily" },
      { id: "p2-position", title: { zh: "确定个人定位：订阅制设计合作伙伴", en: "Establish positioning: subscription design partner" }, freq: "once" },
      { id: "p2-partner", title: { zh: "联系互补服务商（开发/营销/摄影）", en: "Connect with complementary service providers (dev/marketing/photo)" }, freq: "weekly" },
      { id: "p2-pitch", title: { zh: "练习30秒订阅制服务pitch", en: "Practice 30-second subscription service pitch" }, freq: "daily" },
    ],
  },
  {
    id: "phase3",
    label: { zh: "建系统", en: "Build Systems" },
    weeks: { zh: "第7-12周", en: "Week 7-12" },
    strategy: {
      emoji: "🏗️",
      title: { zh: "核心策略：建系统", en: "Core Strategy: Build Systems" },
      content: {
        zh: "到这个阶段，你应该已经有了新的作品集和一定的市场认知度。现在的目标是从「我去找客户」变成「客户来找我」。合作伙伴、内容营销、月费模式——这三个引擎同时运转，收入才能稳定增长。",
        en: "At this stage, you should have a new portfolio and some market recognition. Now the goal shifts from 'I find clients' to 'clients find me.' Partners, content marketing, subscription model — all three engines running simultaneously for stable revenue growth.",
      },
    },
    tasks: [
      { id: "p3-cases", title: { zh: "积累8-10个完整案例", en: "Accumulate 8-10 complete case studies" }, freq: "once" },
      { id: "p3-partners", title: { zh: "建立3+合作伙伴渠道", en: "Build 3+ partner referral channels" }, freq: "once" },
      { id: "p3-premium", title: { zh: "推高端订阅套餐（Professional/Enterprise）", en: "Push premium subscriptions (Professional/Enterprise)" }, freq: "weekly" },
      { id: "p3-flagship", title: { zh: "争取标杆客户（行业知名品牌）", en: "Win flagship clients (well-known brands)" }, freq: "weekly" },
      { id: "p3-digital", title: { zh: "开发数字产品（模板包/设计系统）", en: "Develop digital products (template packs/design systems)" }, freq: "once" },
      { id: "p3-expert", title: { zh: "申请Expert/Top Rated认证", en: "Apply for Expert/Top Rated certification" }, freq: "once" },
      { id: "p3-workshop", title: { zh: "开设工作坊/在线课程", en: "Launch workshops/online courses" }, freq: "once" },
      { id: "p3-retain", title: { zh: "建立客户留存机制（季度review/年度合同）", en: "Build retention system (quarterly reviews/annual contracts)" }, freq: "weekly" },
    ],
  },
];

export const DAILY_REMINDERS: { zh: string; en: string }[] = [
  { zh: "你的技能没有消失。10 年练出来的眼光和速度，没有任何合约能拿走。", en: "Your skills haven't disappeared. The eye and speed built over 10 years — no contract can take that away." },
  { zh: "没有旧作品？那就用新作品让所有人闭嘴。你的速度和质量就是最好的证明。", en: "No old portfolio? Then let new work do the talking. Your speed and quality are the best proof." },
  { zh: "从零开始不是从零开始——你带着 10 年的功力从零开始，这和新手完全不同。", en: "Starting from zero isn't really zero — you're starting with 10 years of mastery. That's completely different from a beginner." },
  { zh: "低调太久了。这个世界不会主动发现你，你必须站出来让他们看到。", en: "You've been quiet too long. The world won't discover you on its own — you have to step up and be seen." },
  { zh: "你不需要 100 个作品，你只需要 3 个让人说不出话的作品。", en: "You don't need 100 pieces — you just need 3 that leave people speechless." },
  { zh: "每一个新项目都是你的武器。从今天起，每做一个就留一个。", en: "Every new project is a weapon. From today, save every single one." },
  { zh: "被雪藏 10 年的大师出山——这本身就是一个好故事。讲好它。", en: "A master emerging after 10 years in the shadows — that's a great story. Tell it well." },
];

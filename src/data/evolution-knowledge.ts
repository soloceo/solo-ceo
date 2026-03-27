export interface Principle {
  id: string;
  name: { zh: string; en: string };
  core: { zh: string; en: string };
  explanation?: { zh: string; en: string };
  actionSteps?: { zh: string; en: string }[];
  checks: { zh: string; en: string }[];
  antiPatterns: { zh: string; en: string }[];
}

export interface KnowledgeCategory {
  id: string;
  emoji: string;
  name: { zh: string; en: string };
  principles: Principle[];
}

export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  {
    id: "deep-sea",
    emoji: "\u{1F30A}",
    name: { zh: "深海哲学", en: "Deep Sea Philosophy" },
    principles: [
      {
        id: "trump-card",
        name: { zh: "底牌意识", en: "Trump Card Awareness" },
        core: { zh: "永远保留一张底牌。不要在一次谈判中亮出所有筹码，留有余地才有回旋空间。", en: "Always keep a card up your sleeve. Never show all your chips in one negotiation — reserve room to maneuver." },
        explanation: { zh: "在商业博弈中，信息就是权力。当你把所有底牌亮给对方时，你就失去了谈判的主动权。真正的高手永远让对方猜不透自己的下一步。这不是欺骗——而是策略性地控制信息流。在报价时留出空间，在展示能力时留有余地，在承诺时保持弹性。这样当对方提出新要求时，你有东西可以'让步'，而这个让步其实早在你的计划之中。", en: "In business, information is power. When you show all your cards, you lose negotiation leverage. Masters always keep the opponent guessing. This isn't deception — it's strategic information control. Leave room in pricing, reserve capability in demonstrations, maintain flexibility in commitments. When the other party makes new demands, you have something to 'concede' — a concession you planned all along." },
        actionSteps: [
          { zh: "报价时至少留出 15-20% 的谈判空间", en: "Leave at least 15-20% negotiation room in your pricing" },
          { zh: "准备每个提案时，预留一个'备选方案B'不要主动提", en: "For every proposal, prepare a 'Plan B' you don't mention proactively" },
          { zh: "在社交场合只分享已公开的信息，核心策略只在内部讨论", en: "Only share public info socially; discuss core strategy internally only" },
        ],
        checks: [
          { zh: "今天我有没有过早暴露我的底线？", en: "Did I reveal my bottom line too early today?" },
          { zh: "我是否在关键谈判中保留了至少一个备选方案？", en: "Did I keep at least one backup option in key negotiations?" },
          { zh: "我的竞争对手知道我多少信息？", en: "How much does my competitor know about me?" },
        ],
        antiPatterns: [
          { zh: "一次性把所有方案都发给客户", en: "Sending all proposals to the client at once" },
          { zh: "在社交场合透露商业计划细节", en: "Revealing business plan details in social settings" },
          { zh: "因为急于成交而接受对方的第一个出价", en: "Accepting the first offer out of eagerness to close" },
        ],
      },
      {
        id: "submarine",
        name: { zh: "潜水艇法则", en: "Submarine Rule" },
        core: { zh: "在水下积蓄力量，在水面上一鸣惊人。不要在准备不充分时急于展示自己。", en: "Build strength underwater, make a splash on the surface. Don't rush to showcase yourself before you're ready." },
        explanation: { zh: "很多创业者犯的最大错误是太早曝光。当你只有想法没有成果时就大肆宣传，结果是消耗了信任额度。潜水艇在水下悄悄移动，等到浮出水面时，已经到了你想去的位置。把精力花在打磨产品、积累案例、建立口碑上，而不是花在推广一个还没准备好的东西上。当你的作品足够好时，一次展示就能让人记住。", en: "The biggest mistake many entrepreneurs make is premature exposure. Promoting without results burns trust capital. A submarine moves silently underwater, surfacing exactly where it needs to be. Invest energy in perfecting your product, building case studies, and earning reputation — not in promoting something unready. When your work is good enough, one showcase creates lasting impact." },
        actionSteps: [
          { zh: "在公开发布前先收集 3 个内测用户的反馈", en: "Collect feedback from 3 beta users before any public launch" },
          { zh: "每周花 80% 时间做产品，20% 时间做曝光", en: "Spend 80% of weekly time on product, 20% on exposure" },
          { zh: "建立一个'弹药清单'：记录你正在积累的每一项能力和作品", en: "Maintain an 'arsenal list': document every skill and work you're building" },
        ],
        checks: [
          { zh: "我今天的行动是在积累还是在消耗？", en: "Were today's actions building or depleting?" },
          { zh: "我是否在没准备好的情况下过早曝光？", en: "Did I expose myself prematurely before being ready?" },
          { zh: "我的'弹药库'今天增加了什么？", en: "What did I add to my 'arsenal' today?" },
        ],
        antiPatterns: [
          { zh: "在没有作品时就大量推广自己", en: "Promoting yourself heavily without a portfolio" },
          { zh: "刚学了一点就急着教别人", en: "Teaching others after just learning the basics" },
          { zh: "在社交媒体上发表未经验证的观点", en: "Posting unverified opinions on social media" },
        ],
      },
      {
        id: "dopamine-trap",
        name: { zh: "多巴胺陷阱", en: "Dopamine Trap" },
        core: { zh: "短期快感是长期成功的敌人。警惕那些让你'感觉良好但没有实际产出'的活动。", en: "Short-term pleasure is the enemy of long-term success. Beware of activities that feel good but produce nothing." },
        explanation: { zh: "人的大脑天生追求即时反馈——点赞、消息提醒、完成小任务的满足感。但这些'伪生产力'会占据你的时间和注意力，让你误以为自己在进步。真正推动业务增长的事情往往是不舒服的：打陌生电话、写长文、处理复杂项目。学会区分'让你感觉好的忙碌'和'真正有产出的工作'，是独立创业者最关键的能力之一。", en: "Our brains are wired for instant feedback — likes, notifications, the satisfaction of completing small tasks. But this 'fake productivity' eats your time and attention, creating an illusion of progress. The work that actually grows your business is often uncomfortable: cold calls, long-form writing, tackling complex projects. Learning to distinguish 'busyness that feels good' from 'work that actually produces results' is one of the most critical skills for solo entrepreneurs." },
        actionSteps: [
          { zh: "每天开始前写下当天最重要的 1 件事，完成它之前不做其他事", en: "Write down the single most important task each morning and finish it before anything else" },
          { zh: "设置'无通知时段'：每天至少 2 小时关闭所有推送和社媒", en: "Set 'notification-free blocks': at least 2 hours daily with all pushes and social media off" },
          { zh: "每周日回顾：列出上周做的事，标记哪些真正产生了收入或客户", en: "Weekly Sunday review: list everything you did and mark what actually generated revenue or clients" },
        ],
        checks: [
          { zh: "今天花了多少时间在'感觉高效但实际无产出'的事上？", en: "How much time today was spent on things that felt productive but weren't?" },
          { zh: "我是否用'忙碌'来逃避真正重要的任务？", en: "Am I using 'busyness' to avoid truly important tasks?" },
          { zh: "今天的最大成就是真实的还是虚假的满足感？", en: "Was today's biggest achievement real or a false sense of satisfaction?" },
        ],
        antiPatterns: [
          { zh: "花2小时调整Logo颜色而不去发开发信", en: "Spending 2 hours tweaking logo colors instead of sending outreach emails" },
          { zh: "不停刷社媒看点赞数", en: "Constantly checking social media likes" },
          { zh: "参加无用的线上会议只为'networking'", en: "Attending useless online meetings just to 'network'" },
        ],
      },
      {
        id: "energy-loop",
        name: { zh: "能量闭环", en: "Energy Loop" },
        core: { zh: "输出必须大于输入的消耗。建立能让你持续产出而不枯竭的系统。", en: "Output must exceed input depletion. Build systems that sustain production without burnout." },
        explanation: { zh: "独立创业者最常犯的错误是只有输出没有输入——持续给客户交付，却不学习新技能、不更新灵感库、不休息恢复。这就像只放电不充电的电池，迟早会耗尽。能量闭环意味着你要设计一个系统：工作产出带来收入和成就感，同时你有固定的时间学习、创作个人项目、休息恢复。当输入和输出形成正循环，你才能可持续地经营下去。", en: "The most common mistake solo entrepreneurs make is all output, no input — constantly delivering to clients without learning new skills, refreshing inspiration, or recovering. It's like a battery that only discharges. Energy Loop means designing a system where work output generates income and fulfillment, while you have dedicated time for learning, personal projects, and recovery. When input and output form a positive cycle, your business becomes sustainable long-term." },
        actionSteps: [
          { zh: "每周固定 3 小时'输入时间'：读书、看课程、研究行业趋势", en: "Block 3 hours weekly as 'input time': reading, courses, researching industry trends" },
          { zh: "建立一个'灵感库'文件夹，每天收集至少 1 个让你受启发的案例", en: "Create an 'inspiration vault' folder and collect at least 1 inspiring case study daily" },
          { zh: "每月做一次精力审计：哪些任务可以外包、自动化或删除", en: "Conduct a monthly energy audit: identify tasks to outsource, automate, or eliminate" },
        ],
        checks: [
          { zh: "今天的输出和输入是否平衡？", en: "Were today's output and input balanced?" },
          { zh: "哪些事情在给我充电，哪些在耗电？", en: "What charged my energy today, what drained it?" },
          { zh: "我的工作流程有没有让我越做越累的环节？", en: "Are there parts of my workflow that increasingly drain me?" },
        ],
        antiPatterns: [
          { zh: "连续工作8小时不休息", en: "Working 8 hours straight without breaks" },
          { zh: "把所有精力花在客户工作上，不留时间给自己的品牌建设", en: "Spending all energy on client work, none on building your own brand" },
          { zh: "总是处于'反应模式'而不是'主动模式'", en: "Always in 'reactive mode' instead of 'proactive mode'" },
        ],
      },
      {
        id: "pressure-cooker",
        name: { zh: "高压锅法则", en: "Pressure Cooker Rule" },
        core: { zh: "适度的压力创造突破，过度的压力导致崩溃。学会在压力中找到最佳状态。", en: "Moderate pressure creates breakthroughs, excessive pressure causes collapse. Find your optimal stress zone." },
        explanation: { zh: "心理学中的'耶基斯-多德森定律'告诉我们：适度压力能提升表现，但超过临界点后表现会急剧下降。作为独立创业者，你需要学会主动制造'良性压力'——比如设定有挑战但可达成的截止日期，同时识别和减轻'恶性压力'——比如财务焦虑或客户冲突。关键是知道自己的临界点在哪里，在接近它之前主动减压。", en: "The Yerkes-Dodson Law in psychology shows that moderate stress enhances performance, but beyond a tipping point, performance drops sharply. As a solo entrepreneur, you need to actively create 'good pressure' — like setting challenging but achievable deadlines — while identifying and reducing 'bad pressure' — like financial anxiety or client conflicts. The key is knowing where your tipping point is and proactively decompressing before you hit it." },
        actionSteps: [
          { zh: "同一时间最多只接 3 个并行项目，超出的排入等待队列", en: "Cap parallel projects at 3 at any time; queue the rest" },
          { zh: "给每个项目设定'黄色警报线'：比截止日提前 3 天检查进度", en: "Set a 'yellow alert line' for each project: check progress 3 days before deadline" },
          { zh: "当感到呼吸急促或失眠时，立刻砍掉或延迟一个非核心任务", en: "When you notice shallow breathing or insomnia, immediately drop or delay a non-core task" },
        ],
        checks: [
          { zh: "我现在的压力水平是在激发我还是在压垮我？", en: "Is my current stress level motivating or crushing me?" },
          { zh: "我有没有给自己设定了不切实际的截止日期？", en: "Did I set unrealistic deadlines for myself?" },
          { zh: "我是否在逃避压力而不是管理压力？", en: "Am I avoiding pressure instead of managing it?" },
        ],
        antiPatterns: [
          { zh: "同时接太多项目导致全部延期", en: "Taking on too many projects, causing all to be delayed" },
          { zh: "因为害怕失败而不敢投高价项目", en: "Not bidding on high-value projects out of fear of failure" },
          { zh: "用酒精/游戏来缓解工作压力", en: "Using alcohol/games to relieve work stress" },
        ],
      },
    ],
  },
  {
    id: "strategy",
    emoji: "\u2694\uFE0F",
    name: { zh: "商业策略", en: "Business Strategy" },
    principles: [
      {
        id: "wrong-pond",
        name: { zh: "错误鱼塘理论", en: "Wrong Pond Theory" },
        core: { zh: "你钓不到鱼可能不是技术问题，而是你在错误的鱼塘里。选对市场比努力更重要。", en: "Not catching fish might not be a skill issue — you might be at the wrong pond. Choosing the right market matters more than effort." },
        explanation: { zh: "很多独立创业者陷入一个死循环：拼命努力却赚不到钱。问题往往不在于能力不够，而在于选错了市场。一个500万预算的客户不会在淘宝上找设计师，一个本地高端餐厅不会在Fiverr上招人。你要做的不是在红海里拼价格，而是找到一个'你的能力被高度需要但竞争不激烈'的蓝海细分市场。换一个鱼塘，可能比在原地加倍努力更有效。", en: "Many solo entrepreneurs are trapped in a cycle: working incredibly hard but not earning enough. The problem often isn't lack of skill — it's the wrong market. A client with a $500K budget won't find designers on bargain platforms. Instead of competing on price in a red ocean, find a blue ocean niche where your skills are in high demand but competition is low. Switching ponds can be far more effective than doubling your effort in the wrong one." },
        actionSteps: [
          { zh: "列出你过去 5 个最满意的客户，找出他们的共同特征（行业/规模/来源）", en: "List your 5 most satisfying past clients and find their common traits (industry/size/source)" },
          { zh: "每月花 2 小时研究一个新的潜在细分市场，评估需求和竞争程度", en: "Spend 2 hours monthly researching one new potential niche — evaluate demand and competition" },
          { zh: "在新鱼塘'试钓'：发 10 条针对性信息测试反应，再决定是否投入", en: "Test-fish in a new pond: send 10 targeted messages to gauge response before committing" },
        ],
        checks: [
          { zh: "我现在的目标客户群是否有足够的付费意愿？", en: "Does my current target audience have sufficient willingness to pay?" },
          { zh: "我是否在和太多低价竞争者争夺同一个市场？", en: "Am I competing with too many low-price competitors in the same market?" },
          { zh: "有没有一个我忽略的、更匹配我能力的高端市场？", en: "Is there a high-end market I'm overlooking that better matches my capabilities?" },
        ],
        antiPatterns: [
          { zh: "在Fiverr上和$5设计师竞争", en: "Competing with $5 designers on Fiverr" },
          { zh: "只盯着华人市场不看本地高端市场", en: "Only targeting Chinese market while ignoring local premium market" },
          { zh: "用价格战而不是价值差异化来竞争", en: "Competing on price instead of value differentiation" },
        ],
      },
      {
        id: "value-anchor",
        name: { zh: "价值锚定", en: "Value Anchoring" },
        core: { zh: "先展示高价值，再报价。让客户先看到你能解决的问题值多少钱，再讨论设计费。", en: "Show high value first, then quote. Let clients see how much the problem you solve is worth before discussing design fees." },
        explanation: { zh: "定价的本质不是'你的时间值多少钱'，而是'你帮客户解决的问题值多少钱'。如果一个品牌升级能帮餐厅多赚50万/年，那你收5万设计费就显得非常合理。关键在于：先帮客户算清楚这笔账，让他们意识到问题的价值，然后你的报价就变成了'投资回报'而不是'成本支出'。这就是锚定的力量——先设定一个高参照点，后面的价格就显得合理了。", en: "Pricing isn't about 'what your time is worth' — it's about 'what the problem you solve is worth.' If a brand refresh helps a restaurant earn $500K more per year, your $50K design fee suddenly looks very reasonable. The key: help clients calculate the math first, making them realize the problem's value. Your quote then becomes 'return on investment' rather than 'cost.' That's the power of anchoring — set a high reference point first, and your price seems reasonable by comparison." },
        actionSteps: [
          { zh: "在每次报价前，先用 3 个问题帮客户量化痛点（损失多少钱/时间/机会）", en: "Before every quote, ask 3 questions to help clients quantify their pain (money/time/opportunity lost)" },
          { zh: "制作一个'ROI 计算器'模板：展示你的服务能带来多少倍回报", en: "Create an 'ROI calculator' template showing how many times over your service pays for itself" },
          { zh: "收集 3 个成功案例，用具体数字展示客户获得的价值提升", en: "Collect 3 success stories with concrete numbers showing the value uplift clients received" },
        ],
        checks: [
          { zh: "我的报价是基于成本还是基于价值？", en: "Is my pricing based on cost or value?" },
          { zh: "客户是否在付款前就感受到了我的专业价值？", en: "Does the client sense my professional value before paying?" },
          { zh: "我有没有把全职设计师的成本作为锚定参考？", en: "Am I using full-time designer costs as an anchor reference?" },
        ],
        antiPatterns: [
          { zh: "上来就报价，没有先展示能力", en: "Quoting immediately without first demonstrating capability" },
          { zh: "让客户主导定价讨论", en: "Letting the client lead the pricing discussion" },
          { zh: "用工时来解释价格而不是用结果", en: "Justifying price by hours rather than outcomes" },
        ],
      },
      {
        id: "dare-refuse",
        name: { zh: "敢于拒绝", en: "Dare to Refuse" },
        core: { zh: "说'不'是建立专业形象的关键。不是所有客户都值得服务，不匹配的客户会拖累你的品牌。", en: "Saying 'no' is key to building a professional image. Not all clients are worth serving — mismatched clients drag down your brand." },
        explanation: { zh: "很多独立创业者因为害怕没有收入而来者不拒，结果被低价客户占满时间，既赚不到钱又做不出好作品。当你接了一个不匹配的低价项目，你不仅浪费了时间，还失去了做高价值项目的机会——这就是隐性成本。学会拒绝不仅能保护你的时间和精力，还会在客户眼中提升你的专业形象。一个敢说'不'的服务商，反而更让人信任。", en: "Many solo entrepreneurs accept every project out of fear of having no income, ending up swamped by low-paying clients with no time for good work. Taking a mismatched low-budget project wastes your time and costs you the opportunity for high-value work — that's hidden cost. Learning to refuse protects your time and energy while elevating your professional image. A service provider who dares to say 'no' actually earns more trust." },
        actionSteps: [
          { zh: "制定一个'红线清单'：列出你绝不接受的 5 种客户/项目类型", en: "Create a 'red line list': define 5 types of clients/projects you will never accept" },
          { zh: "准备一个优雅的拒绝话术模板，推荐替代方案而不是直接说不", en: "Prepare a graceful rejection template that recommends alternatives instead of a flat 'no'" },
          { zh: "每月统计：因为拒绝腾出的时间，你获得了什么更好的机会", en: "Monthly tracking: what better opportunities did you gain from the time freed by saying no" },
        ],
        checks: [
          { zh: "今天有没有因为怕失去客户而接受了不合理的要求？", en: "Did I accept unreasonable requests today out of fear of losing a client?" },
          { zh: "我是否清楚我的服务底线是什么？", en: "Am I clear about my service bottom line?" },
          { zh: "被拒绝或拒绝别人后，我的心态是怎样的？", en: "How's my mindset after being rejected or rejecting others?" },
        ],
        antiPatterns: [
          { zh: "接受所有询价，不管预算多低", en: "Accepting every inquiry regardless of budget" },
          { zh: "答应超出服务范围的要求只为留住客户", en: "Agreeing to out-of-scope requests just to retain clients" },
          { zh: "因为'有总比没有好'而接低价单", en: "Taking low-price jobs because 'something is better than nothing'" },
        ],
      },
      {
        id: "flywheel",
        name: { zh: "飞轮效应", en: "Flywheel Effect" },
        core: { zh: "每一个小动作都在推动飞轮。当积累到临界点，增长会自我加速。坚持每天的小推力。", en: "Every small action pushes the flywheel. At the tipping point, growth becomes self-accelerating. Persist with daily small pushes." },
        explanation: { zh: "飞轮效应来自亚马逊的增长模型：每一次好的服务带来口碑，口碑带来新客户，新客户带来更多案例，更多案例又吸引更多客户。刚开始推飞轮时很重，看不到效果，但一旦转起来就势不可挡。作为独立创业者，你的飞轮可能是：做好项目→发案例→获取新咨询→签约→做好项目。关键是不要在飞轮还没转起来之前就放弃。前100次推动最难，但也最重要。", en: "The Flywheel Effect comes from Amazon's growth model: great service creates word-of-mouth, which brings new clients, creating more case studies, attracting even more clients. The wheel is heaviest at the start — you push hard and see nothing. But once it spins, it's unstoppable. Your flywheel might be: deliver great work → publish case study → attract inquiries → sign clients → deliver great work. The key is not giving up before the wheel starts spinning. The first 100 pushes are the hardest — and the most important." },
        actionSteps: [
          { zh: "定义你的飞轮循环并画出来：每个环节之间是如何推动下一步的", en: "Define and diagram your flywheel loop: how each stage drives the next" },
          { zh: "设定一个'每日最小推力'：比如每天发一条内容或联系一个潜在客户", en: "Set a 'daily minimum push': e.g., post one piece of content or contact one prospect daily" },
          { zh: "每完成一个项目，立刻制作案例并发布——这是推动飞轮最有效的动作", en: "After every completed project, immediately create and publish a case study — the most effective flywheel push" },
        ],
        checks: [
          { zh: "今天做的事情是否在推动我的飞轮？", en: "Did today's actions push my flywheel forward?" },
          { zh: "我的案例→口碑→新客户循环在运转吗？", en: "Is my case study → referral → new client loop working?" },
          { zh: "有哪些事情我应该每天坚持做但没做？", en: "What daily habits should I maintain but haven't?" },
        ],
        antiPatterns: [
          { zh: "频繁切换方向而不是持续积累", en: "Frequently changing direction instead of building consistently" },
          { zh: "只做高投入的大项目，忽略日常内容积累", en: "Only pursuing big projects, neglecting daily content accumulation" },
          { zh: "因为看不到立即效果就放弃", en: "Giving up because results aren't immediate" },
        ],
      },
    ],
  },
  {
    id: "resilience",
    emoji: "\u{1F6E1}\uFE0F",
    name: { zh: "心理韧性", en: "Mental Resilience" },
    principles: [
      {
        id: "anchoring",
        name: { zh: "锚定效应", en: "Anchoring Effect" },
        core: { zh: "你的自我定位决定了别人如何看你。先在内心设定高锚点，外在表现才会跟上。", en: "Your self-positioning determines how others see you. Set a high internal anchor first, and external presentation will follow." },
        explanation: { zh: "锚定效应是行为经济学中最强大的心理现象之一：人们的判断会被第一个接收到的信息深刻影响。如果你介绍自己是'做设计的'，对方心里的锚定价就是几百块。如果你说'我帮企业通过品牌升级提升30%的客户转化率'，锚定价立刻变成了几万块。同样的道理适用于你的内心——你如何定义自己，决定了你做决策时的底线和上限。先在心里把自己当作高端服务商，行为自然会跟上。", en: "Anchoring is one of the most powerful cognitive biases in behavioral economics: people's judgments are deeply influenced by the first piece of information they receive. If you introduce yourself as 'I do design,' the mental price anchor is a few hundred dollars. If you say 'I help businesses increase customer conversion by 30% through brand upgrades,' the anchor jumps to tens of thousands. The same applies internally — how you define yourself determines the floor and ceiling of your decisions. See yourself as a premium provider first, and your behavior will follow." },
        actionSteps: [
          { zh: "重写你的自我介绍：从'我是做XX的'改为'我帮XX客户解决XX问题'", en: "Rewrite your intro: change 'I do XX' to 'I help XX clients solve XX problems'" },
          { zh: "更新所有社媒简介，突出结果和价值而不是技能列表", en: "Update all social media bios to highlight results and value, not skill lists" },
          { zh: "每天早上花 1 分钟默念你的专业定位，强化内心锚点", en: "Spend 1 minute each morning affirming your professional positioning to reinforce your internal anchor" },
        ],
        checks: [
          { zh: "我今天的言行是否匹配我想要的专业定位？", en: "Did my words and actions today match my desired professional positioning?" },
          { zh: "我有没有用'我只是...'来贬低自己？", en: "Did I diminish myself with 'I'm just a...'?" },
          { zh: "如果有人问我做什么，我能自信地说出我的定位吗？", en: "If asked what I do, can I state my positioning with confidence?" },
        ],
        antiPatterns: [
          { zh: "介绍自己时说'我是freelancer'而不是'我经营设计订阅服务'", en: "Introducing yourself as 'freelancer' instead of 'I run a design subscription service'" },
          { zh: "在报价时不好意思说出自己的价格", en: "Being embarrassed to state your price when quoting" },
          { zh: "主动提供折扣而不是等客户提出", en: "Proactively offering discounts before the client asks" },
        ],
      },
      {
        id: "storm-protocol",
        name: { zh: "风暴协议", en: "Storm Protocol" },
        core: { zh: "危机到来时，有预案的人才能存活。为最坏情况准备应急方案，不要在风暴中才开始想对策。", en: "When crisis hits, only those with plans survive. Prepare contingencies for worst cases — don't start strategizing mid-storm." },
        explanation: { zh: "独立创业者最大的风险是'单点故障'——一个大客户流失、一次健康问题、一个行业变动就可能让你的收入归零。风暴协议要求你在晴天时就准备好雨伞：建立3-6个月的应急资金、培养2-3个独立的收入来源、维护一个'紧急联系人清单'。当危机真正到来时，你不需要思考该怎么办——只需要执行预案。恐慌和焦虑来自'不确定'，而预案消除不确定。", en: "The biggest risk for solo entrepreneurs is 'single point of failure' — losing one major client, a health issue, or an industry shift can zero out your income. Storm Protocol means preparing your umbrella on sunny days: build 3-6 months of emergency funds, develop 2-3 independent income streams, maintain an 'emergency contact list.' When crisis actually hits, you don't need to think — just execute the plan. Panic comes from uncertainty, and having a plan eliminates uncertainty." },
        actionSteps: [
          { zh: "本周就开始存'风暴基金'：每月收入的 10% 自动转入独立账户", en: "Start your 'storm fund' this week: auto-transfer 10% of monthly income to a separate account" },
          { zh: "写下一份'如果最大客户明天消失'的应急计划，包含 7 天行动清单", en: "Write a 'what if my biggest client disappears tomorrow' contingency plan with a 7-day action list" },
          { zh: "每季度审视收入结构：任何单一客户占比不应超过总收入的 40%", en: "Review income structure quarterly: no single client should exceed 40% of total revenue" },
        ],
        checks: [
          { zh: "如果明天失去最大客户，我有B计划吗？", en: "If I lost my biggest client tomorrow, do I have a Plan B?" },
          { zh: "我的财务缓冲能支撑多久？", en: "How long can my financial buffer sustain me?" },
          { zh: "我是否过度依赖单一收入来源？", en: "Am I over-reliant on a single income source?" },
        ],
        antiPatterns: [
          { zh: "所有收入依赖一个客户", en: "All income depending on one client" },
          { zh: "没有紧急备用金就开始花钱扩张", en: "Spending on expansion without emergency reserves" },
          { zh: "遇到困难时恐慌而不是执行预案", en: "Panicking instead of executing contingency plans when facing difficulties" },
        ],
      },
      {
        id: "fuel-convert",
        name: { zh: "燃料转化", en: "Fuel Conversion" },
        core: { zh: "把拒绝、失败和挫折转化为前进的燃料。每一次'不'都在告诉你下一步该调整什么。", en: "Convert rejection, failure, and setbacks into fuel for progress. Every 'no' tells you what to adjust next." },
        explanation: { zh: "失败本身没有意义，但你对失败的反应决定一切。同样被客户拒绝，一个人选择放弃，另一个人分析原因并改进提案——半年后两个人的差距会是巨大的。每一次'不'都是免费的市场反馈：客户说太贵了，说明你的价值展示不够；客户不回复，说明你的开发信需要优化。把情绪转化为数据，把数据转化为行动，挫折就变成了最廉价的学习资源。", en: "Failure itself is meaningless — your reaction to it determines everything. Two people get rejected by a client: one gives up, the other analyzes the reason and improves the proposal. Six months later, the gap is enormous. Every 'no' is free market feedback: 'too expensive' means your value demonstration needs work; no reply means your outreach needs optimization. Convert emotions into data, data into action, and setbacks become your cheapest learning resource." },
        actionSteps: [
          { zh: "建立一个'拒绝日志'：记录每次被拒绝的原因和你的改进方案", en: "Start a 'rejection log': document every rejection reason and your improvement plan" },
          { zh: "被拒绝后 24 小时内做复盘，提取至少 1 个可改进点", en: "Within 24 hours of a rejection, do a review and extract at least 1 improvement point" },
          { zh: "每月回顾拒绝日志，找出重复出现的模式并系统性解决", en: "Monthly review your rejection log, identify recurring patterns and address them systematically" },
        ],
        checks: [
          { zh: "今天遇到的挫折，我从中学到了什么？", en: "What did I learn from today's setbacks?" },
          { zh: "我是在消化负面情绪还是在被它吞噬？", en: "Am I digesting negative emotions or being consumed by them?" },
          { zh: "我能否把这次失败变成一个更好的案例？", en: "Can I turn this failure into a better case study?" },
        ],
        antiPatterns: [
          { zh: "被拒绝后放弃那个细分市场", en: "Abandoning a niche after being rejected" },
          { zh: "失败后自我怀疑而不是分析原因", en: "Self-doubting after failure instead of analyzing causes" },
          { zh: "向朋友抱怨而不是调整策略", en: "Complaining to friends instead of adjusting strategy" },
        ],
      },
      {
        id: "ice-walk",
        name: { zh: "冰面行走", en: "Walking on Ice" },
        core: { zh: "在不确定性中保持冷静和前进。像在冰面上行走——稳、慢、但不停下。", en: "Stay calm and keep moving in uncertainty. Like walking on ice — steady, slow, but never stopping." },
        explanation: { zh: "创业的日常充满不确定性：你不知道这个客户会不会签约，不知道这篇帖子会不会火，不知道下个月的收入是多少。很多人因此陷入'分析瘫痪'——因为害怕走错而不敢迈步。冰面行走的智慧是：你不需要看到整条路才能出发，只需要看到下一步就够了。保持小步前进，保持平衡，不追求速度但绝不停下。完成比完美重要一万倍。", en: "Entrepreneurship is filled with daily uncertainty: you don't know if the client will sign, if the post will go viral, or what next month's income will be. Many people fall into 'analysis paralysis' — too afraid of wrong moves to move at all. The wisdom of walking on ice: you don't need to see the whole path to start, just the next step. Keep taking small steps, stay balanced, don't chase speed but never stop. Done is ten thousand times better than perfect." },
        actionSteps: [
          { zh: "每天设定一个'最小可行行动'：即使只有15分钟，也推进一件事", en: "Set one 'minimum viable action' daily: even with just 15 minutes, move one thing forward" },
          { zh: "把大目标拆成每周的小里程碑，只关注本周要完成什么", en: "Break big goals into weekly milestones and focus only on what to complete this week" },
          { zh: "建立'不完美发布'习惯：作品完成80%就发布，收集反馈再迭代", en: "Build an 'imperfect launch' habit: publish at 80% completion, gather feedback, then iterate" },
        ],
        checks: [
          { zh: "面对不确定性时，我是在行动还是在焦虑？", en: "Facing uncertainty, am I taking action or just being anxious?" },
          { zh: "我今天做了哪一个'不完美但前进了'的行动？", en: "What imperfect-but-forward action did I take today?" },
          { zh: "我是否因为追求完美而推迟了行动？", en: "Am I delaying action due to perfectionism?" },
        ],
        antiPatterns: [
          { zh: "因为不确定市场反应就不发内容", en: "Not posting content because of uncertain market response" },
          { zh: "等到作品集'完美'才开始推广", en: "Waiting for a 'perfect' portfolio before promoting" },
          { zh: "花太多时间规划而不是执行", en: "Spending too much time planning instead of executing" },
        ],
      },
    ],
  },
  {
    id: "social",
    emoji: "\u{1F3AD}",
    name: { zh: "社交策略", en: "Social Strategy" },
    principles: [
      {
        id: "signal-emit",
        name: { zh: "信号发射", en: "Signal Emission" },
        core: { zh: "持续向市场发射'我在这里、我很专业'的信号。沉默等于隐形——你不出现，客户就找不到你。", en: "Continuously emit 'I'm here, I'm professional' signals to the market. Silence equals invisibility — if you don't show up, clients can't find you." },
        explanation: { zh: "在信息过载的时代，客户的注意力是最稀缺的资源。你可能是最优秀的设计师，但如果没人知道你的存在，那等于零。信号发射不是自卖自夸——而是持续地展示你的专业能力、分享有价值的见解、让目标客户在需要时能想到你。每一篇帖子、每一封邮件、每一次公开发言都是一次信号发射。频率比质量更重要——因为你永远不知道哪一次信号刚好被对的人接收到。", en: "In an age of information overload, client attention is the scarcest resource. You might be the best designer, but if nobody knows you exist, it counts for nothing. Signal emission isn't bragging — it's consistently demonstrating expertise, sharing valuable insights, and being top of mind when target clients need you. Every post, email, and public appearance is a signal. Frequency matters more than perfection — you never know which signal will reach the right person at the right time." },
        actionSteps: [
          { zh: "设定'每日信号'目标：每天至少在一个平台发布一条专业内容", en: "Set a 'daily signal' goal: publish at least one professional piece of content on one platform daily" },
          { zh: "建立内容日历：提前规划一周的发布主题，减少决策疲劳", en: "Create a content calendar: plan the week's posting topics in advance to reduce decision fatigue" },
          { zh: "把客户项目中的洞察（脱敏后）变成公开分享的内容", en: "Turn insights from client projects (anonymized) into publicly shared content" },
        ],
        checks: [
          { zh: "今天我向市场发射了什么信号？（发帖/邮件/社交）", en: "What signals did I emit to the market today? (posts/emails/social)" },
          { zh: "我的LinkedIn/社媒今天有新内容吗？", en: "Did my LinkedIn/social media have new content today?" },
          { zh: "如果有人今天搜索我的名字，能找到什么？", en: "If someone searched my name today, what would they find?" },
        ],
        antiPatterns: [
          { zh: "一周不发任何内容", en: "Not posting any content for a week" },
          { zh: "只在私人群组分享观点而不公开发表", en: "Only sharing opinions in private groups, not publicly" },
          { zh: "期待被'发现'而不主动推广", en: "Hoping to be 'discovered' instead of actively promoting" },
        ],
      },
      {
        id: "thousand-x",
        name: { zh: "1000倍法则", en: "1000x Rule" },
        core: { zh: "你的信息被看到的概率极低。需要1000次曝光才能产生1个有效联系。数量是质量的前提。", en: "The probability of your message being seen is extremely low. It takes 1000 exposures to produce 1 meaningful connection. Volume precedes quality." },
        explanation: { zh: "大多数人高估了单次曝光的效果，低估了触达的数量要求。数据告诉我们：100封开发信可能只有5个打开，5个打开中只有1个回复，3个回复中才有1个成交。这意味着你需要发300封信才能签1个客户。这不是效率低——这就是营销的真实转化率。理解这个数字之后，你就不会因为10封信没回复而气馁了。把它当作数学题：要达成目标收入，你每天需要发射多少次信号？然后执行。", en: "Most people overestimate the impact of a single exposure and underestimate the volume required. The data says: 100 outreach emails might get 5 opens, 5 opens yield 1 reply, and 3 replies produce 1 deal. That means you need 300 emails for 1 client. This isn't inefficiency — it's the real conversion rate of marketing. Once you understand these numbers, 10 unanswered emails won't discourage you. Treat it as math: to hit your target income, how many signals do you need to send daily? Then execute." },
        actionSteps: [
          { zh: "建立一个追踪表格：记录每周的触达数量、回复率、转化率", en: "Build a tracking spreadsheet: record weekly outreach volume, reply rate, and conversion rate" },
          { zh: "设定每日最低触达量（如 5 条 LinkedIn 消息 + 3 封邮件），雷打不动", en: "Set a daily minimum outreach quota (e.g., 5 LinkedIn messages + 3 emails) — rain or shine" },
          { zh: "批量化你的触达流程：用模板+个性化组合提高效率，减少逐条写的时间", en: "Batch your outreach process: use template + personalization combos to boost efficiency" },
        ],
        checks: [
          { zh: "今天我的内容/信息触达了多少人？", en: "How many people did my content/messages reach today?" },
          { zh: "我是否因为没有立即回应就停止了推广？", en: "Did I stop promoting because of no immediate response?" },
          { zh: "我是否在追踪我的触达数据？", en: "Am I tracking my outreach metrics?" },
        ],
        antiPatterns: [
          { zh: "发了3封开发信没回复就放弃", en: "Giving up after 3 unanswered outreach emails" },
          { zh: "一篇帖子没有互动就觉得'不适合我'", en: "Thinking 'this isn't for me' after one post gets no engagement" },
          { zh: "质量强迫症——每篇帖子都要'完美'再发", en: "Quality paralysis — every post must be 'perfect' before publishing" },
        ],
      },
      {
        id: "mirror",
        name: { zh: "镜子法则", en: "Mirror Rule" },
        core: { zh: "你吸引的客户反映你展示的形象。想要高端客户，先让自己看起来像高端服务商。", en: "The clients you attract reflect the image you project. Want premium clients? First look like a premium service provider." },
        explanation: { zh: "客户在决定是否联系你之前，已经通过你的网站、社媒、作品集形成了第一印象。如果你的品牌看起来像廉价服务商，你就只能吸引到预算有限的客户。这不是虚荣——这是市场定位。高端客户选择服务商的标准和普通客户完全不同：他们看你服务过的品牌、你展示的思考深度、你的沟通专业度。镜子法则提醒你：你展示什么，就吸引什么。想要改变客户质量，先改变你对外展示的一切。", en: "Before a client even contacts you, they've already formed a first impression from your website, social media, and portfolio. If your brand looks like a budget provider, you'll only attract budget clients. This isn't vanity — it's market positioning. Premium clients evaluate service providers differently: they look at brands you've served, depth of thinking you display, and communication professionalism. The Mirror Rule reminds you: what you project is what you attract. To change client quality, first change everything you present externally." },
        actionSteps: [
          { zh: "用你服务客户的标准重新设计自己的品牌物料（名片、网站、提案模板）", en: "Redesign your own brand materials (business cards, website, proposal templates) to the standard you deliver for clients" },
          { zh: "从作品集中删除所有低端项目，只保留最能代表你目标定位的 5-8 个案例", en: "Remove all low-end projects from your portfolio; keep only 5-8 cases that represent your target positioning" },
          { zh: "研究3个你理想客户级别的竞争对手，对标他们的展示水准", en: "Study 3 competitors at your ideal client level and benchmark their presentation standards" },
        ],
        checks: [
          { zh: "我的作品集/网站是否匹配我想收的价格？", en: "Does my portfolio/website match the prices I want to charge?" },
          { zh: "我的社媒形象是否专业一致？", en: "Is my social media presence professional and consistent?" },
          { zh: "我今天的沟通方式是否像一个高端服务商？", en: "Did I communicate like a premium service provider today?" },
        ],
        antiPatterns: [
          { zh: "用Canva模板做自己的品牌物料", en: "Using Canva templates for your own brand materials" },
          { zh: "邮件/消息中用太多表情或过于随意", en: "Using too many emojis or being too casual in emails" },
          { zh: "作品集展示低端项目而期待高端客户", en: "Showcasing low-end projects while expecting premium clients" },
        ],
      },
    ],
  },
  {
    id: "energy",
    emoji: "\u26A1",
    name: { zh: "精力管理", en: "Energy Management" },
    principles: [
      {
        id: "battery",
        name: { zh: "电量意识", en: "Battery Awareness" },
        core: { zh: "你的精力像电池——有限且需要管理。了解自己的电量周期，在高电量时做高价值任务。", en: "Your energy is like a battery — limited and needs management. Know your energy cycles, do high-value tasks when fully charged." },
        explanation: { zh: "人的精力不是匀速消耗的，而是有明显的高峰和低谷。大多数人的创造力高峰在上午9-12点，而下午2-4点是低谷期。如果你在精力高峰时回邮件、开会、做杂事，等到精力耗尽再做设计或写提案，结果一定很差。电量意识要求你追踪自己的精力周期，把最重要、最需要创造力的工作安排在高电量时段，把机械性工作留给低电量时段。这一个改变就能让你的产出质量翻倍。", en: "Human energy doesn't deplete evenly — it has clear peaks and valleys. Most people's creative peak is 9 AM - 12 PM, with a trough from 2-4 PM. If you spend peak hours on emails, meetings, and admin, then try to design or write proposals when depleted, the results will be poor. Battery Awareness means tracking your energy cycle, scheduling your most important creative work during peak hours, and leaving mechanical tasks for low-energy periods. This single change can double your output quality." },
        actionSteps: [
          { zh: "连续一周记录每小时的精力状态（1-10分），找到你的黄金时段", en: "Track your energy level (1-10) every hour for one week to identify your golden hours" },
          { zh: "把日历重新排列：黄金时段只做核心创作/战略工作，禁止会议和杂务", en: "Reorganize your calendar: golden hours for core creative/strategic work only — no meetings or admin" },
          { zh: "在低电量时段建立固定流程：统一回复邮件、整理文件、更新任务列表", en: "Build fixed routines for low-energy periods: batch-reply emails, organize files, update task lists" },
        ],
        checks: [
          { zh: "今天我把最高精力时段用在了什么任务上？", en: "What tasks did I dedicate my peak energy hours to today?" },
          { zh: "我是否在低精力时做了需要创造力的工作？", en: "Did I do creative work during low-energy periods?" },
          { zh: "我清楚自己的精力高峰是几点到几点吗？", en: "Do I know my peak energy hours?" },
        ],
        antiPatterns: [
          { zh: "早上精力最好的时候先回邮件", en: "Spending peak morning energy on emails" },
          { zh: "不分时段地安排所有任务", en: "Scheduling all tasks without considering energy levels" },
          { zh: "在疲劳时做重要决策", en: "Making important decisions when fatigued" },
        ],
      },
      {
        id: "depth-first",
        name: { zh: "深度优先", en: "Depth First" },
        core: { zh: "多任务切换是效率的杀手。一次专注一件事，做到深度，再切换到下一件。", en: "Task switching kills efficiency. Focus deeply on one thing at a time before switching to the next." },
        explanation: { zh: "研究表明每次任务切换会消耗23分钟才能重新进入专注状态。如果你一天切换10次，就浪费了将近4小时。独立创业者的工作天然是碎片化的——客户消息、设计工作、财务管理、内容创作都要自己做。深度优先策略是：把一天分成2-3个时间块，每个时间块只做一类事情。先完成当前任务再切换到下一个。深度工作90分钟的产出，往往超过浅层忙碌一整天。", en: "Research shows each task switch costs 23 minutes to regain deep focus. If you switch 10 times a day, you waste nearly 4 hours. Solo entrepreneurs' work is inherently fragmented — client messages, design work, finances, content creation all fall on you. The Depth First strategy: divide your day into 2-3 time blocks, each dedicated to one type of work. Finish the current task before switching. 90 minutes of deep work often outproduces an entire day of shallow busyness." },
        actionSteps: [
          { zh: "实践'90分钟深度块'：设定计时器，90分钟内只做一件事，完成后休息15分钟", en: "Practice '90-minute deep blocks': set a timer, do only one thing for 90 minutes, then rest 15 minutes" },
          { zh: "关闭所有通知，设定固定的'消息处理时段'（如上午11点和下午4点各30分钟）", en: "Turn off all notifications; set fixed 'message processing windows' (e.g., 11 AM and 4 PM, 30 min each)" },
          { zh: "在工作区域放一个'进行中'标签：写上当前唯一任务，提醒自己不要分心", en: "Place an 'in progress' label in your workspace with your current single task to remind yourself not to stray" },
        ],
        checks: [
          { zh: "今天我有没有在一个任务上做到'深度'？", en: "Did I achieve 'depth' on any task today?" },
          { zh: "我切换任务的频率是否太高？", en: "Am I switching tasks too frequently?" },
          { zh: "我是否把手机/通知管理好了？", en: "Have I managed my phone/notifications well?" },
        ],
        antiPatterns: [
          { zh: "同时开5个任务，每个都做一点", en: "Having 5 tasks open, doing a little on each" },
          { zh: "每10分钟查一次手机", en: "Checking phone every 10 minutes" },
          { zh: "在设计时同时回消息", en: "Replying to messages while designing" },
        ],
      },
      {
        id: "strategic-rest",
        name: { zh: "战略性休息", en: "Strategic Rest" },
        core: { zh: "休息不是偷懒，是战略投资。高效的休息让你的下一个工作周期产出加倍。", en: "Rest isn't laziness, it's a strategic investment. Effective rest doubles the output of your next work cycle." },
        explanation: { zh: "独立创业者最容易陷入'永远在工作'的陷阱——因为工作和生活的界限模糊，你会觉得休息就是在浪费赚钱的时间。但科学证明：持续工作不休息会导致决策质量下降、创造力枯竭、甚至身体生病。战略性休息不是'什么都不做'，而是主动安排能恢复精力的活动：运动、散步、冥想、做与工作无关的事。真正的高效不是工作16小时，而是工作6小时但每一小时都在巅峰状态。", en: "Solo entrepreneurs easily fall into the 'always working' trap — blurred work-life boundaries make rest feel like wasted earning time. But science proves that continuous work without rest degrades decision quality, depletes creativity, and even causes illness. Strategic rest isn't 'doing nothing' — it's proactively scheduling energy-restoring activities: exercise, walks, meditation, non-work hobbies. True productivity isn't working 16 hours; it's working 6 hours where every hour is at peak performance." },
        actionSteps: [
          { zh: "在日历上像安排会议一样安排休息：每天至少2个15分钟的'充电时间'", en: "Schedule rest like meetings on your calendar: at least two 15-minute 'recharge breaks' daily" },
          { zh: "建立一个'休息菜单'：列出5个能真正恢复你精力的活动（不含手机）", en: "Build a 'rest menu': list 5 activities that genuinely restore your energy (no phone involved)" },
          { zh: "每周至少一个完整的'离线日'：不看工作消息，让大脑彻底重启", en: "Take at least one full 'offline day' weekly: no work messages, let your brain fully reboot" },
        ],
        checks: [
          { zh: "今天的休息是'充电式'还是'逃避式'？", en: "Was today's rest 'recharging' or 'escapist'?" },
          { zh: "我是否在工作间安排了有效的短休息？", en: "Did I schedule effective short breaks between work?" },
          { zh: "晚上的时间是在恢复还是在消耗？", en: "Is my evening time recovering or depleting?" },
        ],
        antiPatterns: [
          { zh: "休息时间刷社媒（不是真正休息）", en: "Scrolling social media during breaks (not real rest)" },
          { zh: "周末也在工作，没有恢复日", en: "Working on weekends with no recovery days" },
          { zh: "把'什么都不做'等同于休息", en: "Equating 'doing nothing' with resting" },
        ],
      },
    ],
  },
];

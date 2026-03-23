export interface Principle {
  id: string;
  name: { zh: string; en: string };
  core: { zh: string; en: string };
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

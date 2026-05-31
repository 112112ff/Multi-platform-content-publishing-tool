import { FormEvent, useMemo, useState } from "react";
import { MatrixDeliveryPanel } from "./components/MatrixDeliveryPanel";
import { emptyContentInput, sampleContentInput } from "./data/sampleContent";
import {
  buildAgentOperationPlan,
  demoAccountChannels,
  type AccountChannel,
  type AgentOperationPlan,
} from "./integrations/matrixOperationEngine";
import { adaptContentForSelectedPlatforms } from "./services/adaptContent";
import { sendJobsToExtensionBridge } from "./services/extensionBridge";
import { deliverPreviewToReceiver } from "./services/realDelivery";
import type { PlatformPreview } from "./services/adaptContent";
import type { AdaptedContent, ContentInput } from "./types/content";
import type { ConnectedAccount, DeliveryResult } from "./types/delivery";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type InspirationCard = {
  id: string;
  category: string;
  style: "note" | "qa" | "video" | "article" | "micro" | "vertical";
  title: string;
  subtitle: string;
  badge?: string;
  body: string[];
  tags?: string[];
  metrics: string[];
  callouts: {
    label: string;
    text: string;
  }[];
  detail: string;
};

const platformAlias: Record<string, string> = {
  公众号: "wechat",
  微信: "wechat",
  知乎: "zhihu",
  B站: "bilibili",
  哔哩哔哩: "bilibili",
  小红书: "xiaohongshu",
  微博: "weibo",
  抖音: "douyin",
  快手: "kuaishou",
};

const quickPrompts = [
  "帮我把一篇学习方法内容发到小红书和知乎",
  "我要做 AI 工具提升学习效率的全平台文案",
  "内容更口语化一点，适合小红书种草",
  "把右侧预览改得更短，更适合短视频平台",
];

const accountAwarePlatformIds = [
  "wechat",
  "zhihu",
  "bilibili",
  "xiaohongshu",
  "weibo",
  "douyin",
];

const extraAccountChannels: AccountChannel[] = [
  {
    id: "wechat-official",
    platformId: "wechat",
    displayName: "公众号内容号",
    persona: "长文结构、专业背书、私域沉淀",
    audience: "公众号读者、品牌私域用户、深度阅读用户",
    contentAngles: ["深度拆解", "方法论", "案例复盘", "行动清单"],
    authMode: "official-oauth",
    canSchedule: true,
    canAutoUpload: false,
    dailyPostLimit: 4,
  },
  {
    id: "weibo-topic",
    platformId: "weibo",
    displayName: "微博热点互动号",
    persona: "短观点、话题参与、转评互动",
    audience: "热点浏览用户、轻内容用户、话题讨论用户",
    contentAngles: ["热点话题", "金句观点", "评论互动", "转发讨论"],
    authMode: "official-oauth",
    canSchedule: true,
    canAutoUpload: false,
    dailyPostLimit: 8,
  },
];

const platformLoginEntries: Record<
  string,
  { loginUrl: string; loginLabel: string }
> = {
  wechat: {
    loginUrl: "https://mp.weixin.qq.com/",
    loginLabel: "打开公众号平台",
  },
  zhihu: {
    loginUrl: "https://www.zhihu.com/signin",
    loginLabel: "打开知乎登录",
  },
  bilibili: {
    loginUrl: "https://member.bilibili.com/platform/home",
    loginLabel: "打开B站创作中心",
  },
  xiaohongshu: {
    loginUrl: "https://creator.xiaohongshu.com/",
    loginLabel: "打开小红书创作服务",
  },
  weibo: {
    loginUrl: "https://weibo.com/login.php",
    loginLabel: "打开微博登录",
  },
  douyin: {
    loginUrl: "https://creator.douyin.com/",
    loginLabel: "打开抖音创作者中心",
  },
};

const createAccountState = (): ConnectedAccount[] =>
  accountAwarePlatformIds.map((platformId) => {
    const account = [...demoAccountChannels, ...extraAccountChannels].find(
      (item) => item.platformId === platformId,
    );
    const loginEntry = platformLoginEntries[platformId];

    if (!account || !loginEntry) {
      throw new Error(`missing account connector config: ${platformId}`);
    }

    return {
      ...account,
      ...loginEntry,
      status: "disconnected",
    };
  });

const accountStatusLabel: Record<ConnectedAccount["status"], string> = {
  connected: "已确认",
  disconnected: "待确认",
};

const publishResultLabel: Record<DeliveryResult["status"], string> = {
  success: "已实发",
  failed: "投递失败",
  blocked: "待处理",
};

const authModeLabel: Record<AccountChannel["authMode"], string> = {
  "official-oauth": "官方授权",
  "browser-session": "浏览器登录态",
  "cookie-vault": "安全登录态",
};

const getPlatformLabel = (platformId: string) =>
  Object.entries(platformAlias).find(([, id]) => id === platformId)?.[0] ?? platformId;

const inspirationCards: InspirationCard[] = [
  {
    id: "lifestyle-note",
    category: "生活方式笔记",
    style: "note",
    title: "5个让我生活变轻松的习惯",
    subtitle: "坚持了半年，真的有用！分享给同样想变好的你~",
    badge: "真实体验",
    body: ["数字+结果引发好奇", "真实体验增强可信度", "生活场景图代入感强", "收藏/点赞互动率高"],
    tags: ["自律生活", "习惯养成", "生活小技巧"],
    metrics: ["1.2w", "9800", "432"],
    callouts: [
      { label: "爆点", text: "数字+结果，引发好奇" },
      { label: "信任", text: "真实体验，增强可信度" },
      { label: "场景", text: "生活场景图，代入感强" },
      { label: "转化", text: "收藏/点赞，互动率高" },
    ],
    detail:
      "这类笔记的核心不是炫技巧，而是把一个大众小麻烦变成“我也能照着做”的轻行动清单。系统会优先生成数字标题、真实体验语气和可收藏标签。",
  },
  {
    id: "qa-answer",
    category: "问答类回答",
    style: "qa",
    title: "如何高效养成早起习惯？",
    subtitle: "后来看我总结出 3 个关键步骤，帮我稳定早起 200+ 天：",
    body: [
      "痛点开场：我也曾是起床困难户，试了很多方法...",
      "睡前准备：减少早晨的决策成本",
      "渐进调整：每次提前 15 分钟",
      "早起奖励：给自己一个小期待",
    ],
    metrics: ["赞同 1.1w", "评论 870", "收藏 1.6w"],
    callouts: [
      { label: "爆点", text: "痛点开场，引发共鸣" },
      { label: "信任", text: "方法论+数据，增强说服力" },
      { label: "场景", text: "步骤清晰，易于执行" },
      { label: "转化", text: "互动+收藏，沉淀价值" },
    ],
    detail:
      "问答类内容要让读者立刻确认“这就是我的问题”。系统会把原文改成问题标题、答案开头、步骤列表和可收藏结论。",
  },
  {
    id: "video-content",
    category: "视频类内容",
    style: "video",
    title: "3个方法 让你轻松拍出电影感视频",
    subtitle: "新手也能学会的拍摄技巧｜附参数分享",
    body: ["数字+结果吸引点击", "画面质感强激发兴趣", "经验分享降低门槛", "播放+关注提升粉丝"],
    metrics: ["23.6w", "1.3w", "2560", "3.8w"],
    callouts: [
      { label: "爆点", text: "数字+结果，吸引点击" },
      { label: "场景", text: "画面质感强，激发兴趣" },
      { label: "信任", text: "经验分享，降低门槛" },
      { label: "转化", text: "播放+关注，提升粉丝" },
    ],
    detail:
      "视频类内容先卖结果，再展示过程。系统会补封面大字、开场口播、章节看点和评论互动句，让用户先愿意点开再愿意看完。",
  },
  {
    id: "long-article",
    category: "长文/公众号号风格",
    style: "article",
    title: "普通人如何通过自律改变生活？",
    subtitle: "自律不是自我折磨，而是对人生的掌控。",
    badge: "干货分享",
    body: [
      "我用这 3 个方法，从拖延到自律，生活发生了翻天覆地的变化。",
      "一、建立系统，而不是靠意志力",
      "把目标拆解成每天可执行的小任务，降低开始的门槛。",
    ],
    metrics: ["原创", "10 分钟阅读"],
    callouts: [
      { label: "爆点", text: "问题式标题，直击需求" },
      { label: "信任", text: "结构清晰，专业感强" },
      { label: "场景", text: "长文沉浸阅读，深度价值" },
      { label: "转化", text: "在看/分享，扩大影响" },
    ],
    detail:
      "公众号要承担完整解释。系统会把内容整理为摘要、导语、分级标题和行动清单，让读者感觉值得读完、值得收藏、值得转发。",
  },
  {
    id: "micro-blog",
    category: "微博客/热评风格",
    style: "micro",
    title: "自律的本质：不是自我感动，而是为了更自由的人生而努力。",
    subtitle: "别等到焦虑了才开始改变，从今天的小事开始。",
    body: ["金句式表达引发认同", "个人观点增强共鸣", "碎片化阅读快速获取", "互动传播扩大触达"],
    tags: ["自律", "成长", "生活感悟"],
    metrics: ["转发 328", "评论 186", "赞 1024"],
    callouts: [
      { label: "爆点", text: "金句式表达，引发认同" },
      { label: "信任", text: "个人观点，增强共鸣" },
      { label: "场景", text: "碎片化阅读，快速获取" },
      { label: "转化", text: "互动传播，扩大触达" },
    ],
    detail:
      "热评风格的重点是低成本传播。系统会把长内容压缩成一句立场鲜明的观点，再补充讨论入口，让用户有转发和评论的理由。",
  },
  {
    id: "vertical-video",
    category: "短视频/竖版内容",
    style: "vertical",
    title: "前5秒看点！3个方法 告别拖延症",
    subtitle: "前5秒钩子抓住注意力",
    body: ["前5秒钩子抓住注意力", "竖屏沉浸代入感强", "真人出镜更有说服力", "点赞+关注提升粉丝"],
    metrics: ["8.2w", "2360", "3.4w", "1.1w"],
    callouts: [
      { label: "爆点", text: "前5秒钩子，抓住注意力" },
      { label: "场景", text: "竖屏沉浸，代入感强" },
      { label: "信任", text: "真人出镜，更有说服力" },
      { label: "转化", text: "点赞+关注，提升粉丝" },
    ],
    detail:
      "竖版短视频最怕慢热。系统会把内容改成前 5 秒钩子、短句口播和明确动作，让用户立刻知道为什么要继续看。",
  },
];

const createMessage = (role: ChatMessage["role"], text: string): ChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  text,
});

const extractSelectedPlatforms = (command: string, fallback: string[]) => {
  const selected = Object.entries(platformAlias)
    .filter(([alias]) => command.includes(alias))
    .map(([, platformId]) => platformId);

  if (command.includes("全平台") || command.includes("全部平台")) {
    return emptyContentInput.selectedPlatformIds;
  }

  return selected.length ? [...new Set(selected)] : fallback;
};

const cleanTopic = (value: string) =>
  value
    .replace(/^(把|将|给|做|写|生成|准备|一篇|一个|一下)+/g, "")
    .replace(/(的|地|得|文案|内容|文章|草稿|版本|页面|预览|右侧预览)$/g, "")
    .replace(/^(这个|那个|当前|现在)/g, "")
    .replace(/(^|\s)(和|与|及|以及|、)(\s|$)/g, " ")
    .replace(/(和|与|及|以及|、)$/g, "")
    .trim();

const getTopic = (command: string) => {
  const normalized = command
    .replace(/帮我|请|我要|需要|生成|写一篇|做一篇|内容|文案|关于|发到|发布到/g, " ")
    .replace(/把右侧预览改得|右侧预览|实时预览|预览/g, " ")
    .replace(/小红书|知乎|公众号|微信|B站|哔哩哔哩|微博|抖音|全平台|全部平台/g, " ")
    .replace(/更口语化一点|更口语化|更短一点|更短|更适合|精简|种草|短视频平台|马上能用的方法/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return cleanTopic(normalized);
};

const buildDraftFromCommand = (
  command: string,
  current: ContentInput,
): ContentInput => {
  if (command.includes("示例") || command.toLowerCase().includes("demo")) {
    return sampleContentInput;
  }

  const selectedPlatformIds = extractSelectedPlatforms(
    command,
    current.selectedPlatformIds.length
      ? current.selectedPlatformIds
      : emptyContentInput.selectedPlatformIds,
  );
  const isRevisionCommand =
    Boolean(current.title.trim()) &&
    (command.includes("右侧预览") ||
      command.includes("更短") ||
      command.includes("精简") ||
      command.includes("口语") ||
      command.includes("标题") ||
      command.includes("修改") ||
      command.includes("改"));
  const previousTopic = cleanTopic(current.title)
    .replace(/：.*$/, "")
    .replace(/，.*$/, "")
    .trim();
  const topic =
    (isRevisionCommand ? previousTopic : getTopic(command)) ||
    previousTopic ||
    "AI 工具如何帮助大学生提升学习效率";
  const wantsShort = command.includes("短") || command.includes("精简");
  const wantsCasual =
    command.includes("口语") || command.includes("小红书") || command.includes("种草");
  const wantsVideo =
    command.includes("短视频") || command.includes("B站") || command.includes("抖音");

  const title = wantsCasual
    ? `${topic}，我真的建议你试试`
    : wantsVideo
      ? `${topic}：3 个马上能用的方法`
      : `${topic}：一份可直接发布的内容草稿`;

  const paragraphs = wantsShort
    ? [
        `${topic}这件事，核心不是多用工具，而是把复杂步骤拆成能马上执行的小动作。`,
        "先确定目标，再让 AI 帮你整理提纲、生成检查清单，最后自己判断哪些内容真的可靠。",
        "发布前我会保留一个明确结论、一个真实场景和一个行动建议，这样读者更容易看完并收藏。",
      ]
    : [
        `我想把“${topic}”整理成一份更适合多平台传播的内容。它解决的是一个很常见的小麻烦：想表达清楚，但每个平台的语气、长度和重点都不一样。`,
        "我的做法是先保留一个完整观点，再按平台重新组织表达。长文平台强调逻辑和结论，社区平台强调体验和共鸣，视频平台则需要更快进入问题。",
        "真正有效的内容不是复制同一段文字，而是让同一个观点在不同场景里都像原生内容。这样既节省创作者时间，也不会让用户觉得是在硬广或搬运。",
        "发布前我会检查三件事：标题是不是一眼能看懂，正文有没有明确场景，结尾有没有给读者一个可以评论、收藏或行动的理由。",
      ];

  return {
    ...current,
    title,
    body: paragraphs.join("\n\n"),
    tags: wantsCasual
      ? ["真实体验", "效率工具", "内容创作", "新手友好"]
      : ["内容分发", "效率工具", "AI创作", "多平台发布"],
    coverUrl: current.coverUrl || sampleContentInput.coverUrl,
    videoUrl: current.videoUrl || sampleContentInput.videoUrl,
    selectedPlatformIds,
  };
};

const getScoreTone = (score: number) => {
  if (score >= 88) {
    return "good";
  }
  if (score >= 72) {
    return "medium";
  }
  return "risk";
};

function App() {
  const [content, setContent] = useState<ContentInput>(emptyContentInput);
  const [agentInput, setAgentInput] = useState("");
  const [activePlatformId, setActivePlatformId] = useState("wechat");
  const [editedContent, setEditedContent] = useState<Record<string, AdaptedContent>>({});
  const [selectedInspiration, setSelectedInspiration] =
    useState<InspirationCard | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>(
    createAccountState,
  );
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalReason, setAccountModalReason] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [receiverUrl, setReceiverUrl] = useState("");
  const [publishResults, setPublishResults] = useState<DeliveryResult[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      "assistant",
      "告诉我你想发布什么、面向谁、希望发到哪些平台。我会先和你确认方向，然后在右侧生成可预览的多平台文案。",
    ),
  ]);

  const generatedPreviews = useMemo(
    () => adaptContentForSelectedPlatforms(content),
    [content],
  );
  const previews: PlatformPreview[] = generatedPreviews.map((preview) => {
    const adapted = editedContent[preview.adapted.platformId] ?? preview.adapted;
    return {
      ...preview,
      adapted,
      validation: preview.adapter.validate(adapted, content),
    };
  });
  const activePreview =
    previews.find((preview) => preview.adapted.platformId === activePlatformId) ??
    previews[0];
  const hasContent = Boolean(content.title.trim() || content.body.trim());
  const operationPlan: AgentOperationPlan | null = useMemo(
    () =>
      hasContent
        ? buildAgentOperationPlan(content, connectedAccounts)
        : null,
    [connectedAccounts, content, hasContent],
  );
  const selectedPlatformSet = useMemo(
    () => new Set(content.selectedPlatformIds),
    [content.selectedPlatformIds],
  );
  const desiredAccountConnections = useMemo(() => {
    return connectedAccounts.filter((account) =>
      selectedPlatformSet.has(account.platformId),
    );
  }, [connectedAccounts, selectedPlatformSet]);
  const modalAccounts = useMemo(
    () =>
      [...connectedAccounts].sort(
        (left, right) =>
          Number(selectedPlatformSet.has(right.platformId)) -
          Number(selectedPlatformSet.has(left.platformId)),
      ),
    [connectedAccounts, selectedPlatformSet],
  );
  const missingAccountConnections = desiredAccountConnections.filter(
    (account) => account.status !== "connected",
  );
  const communicationScore = previews.length
    ? Math.round(
        previews.reduce((sum, preview) => sum + preview.validation.score, 0) /
          previews.length,
      )
    : 0;
  const workflowSteps = [
    {
      label: "说出需求",
      detail: "用一句话告诉 Agent 主题、平台和语气",
      state: hasContent ? "done" : "active",
    },
    {
      label: "生成版本",
      detail: "自动改写成各平台标题、正文和标签",
      state: hasContent ? "active" : "waiting",
    },
    {
      label: "确认登录",
      detail: missingAccountConnections.length
        ? `还差 ${missingAccountConnections.length} 个平台确认登录`
        : "平台草稿发送条件已就绪",
      state: !hasContent
        ? "waiting"
        : missingAccountConnections.length
          ? "active"
          : "done",
    },
    {
      label: "发送草稿",
      detail: publishResults.length
        ? "已生成投递反馈"
        : "测试接收端实发或扩展打开创作页",
      state: publishResults.length ? "done" : "waiting",
    },
  ];

  const updateContentFromAgent = (command: string) => {
    const nextContent = buildDraftFromCommand(command, content);
    setContent(nextContent);
    setEditedContent({});
    setActivePlatformId(nextContent.selectedPlatformIds[0] ?? "wechat");
    return nextContent;
  };

  const runAgentCommand = (rawCommand = agentInput) => {
    const command = rawCommand.trim();
    if (!command) {
      return;
    }

    const nextContent = updateContentFromAgent(command);
    const selectedNames = adaptContentForSelectedPlatforms(nextContent)
      .map((preview) => preview.platformName)
      .join("、");
    const needsAccount = connectedAccounts.some(
      (account) =>
        nextContent.selectedPlatformIds.includes(account.platformId) &&
        account.status !== "connected",
    );

    setMessages((current) => [
      ...current,
      createMessage("user", command),
      createMessage(
        "assistant",
        `我已经按你的要求更新右侧预览。当前会生成 ${selectedNames || "默认平台"} 版本${
          needsAccount ? "，发送到平台创作页前需要先确认对应平台已登录" : ""
        }。你可以继续告诉我“更短一点”“更像小红书”“标题更抓人”。`,
      ),
    ]);
    if (needsAccount) {
      setAccountModalReason(
        "这次选择的平台需要先确认你已经在浏览器登录。确认后才能把草稿发送到平台创作页；Webhook 实发不受影响。",
      );
      setAccountModalOpen(true);
    }
    setAgentInput("");
  };

  const updateActivePreview = (patch: Partial<AdaptedContent>) => {
    if (!activePreview) {
      return;
    }

    setEditedContent((current) => ({
      ...current,
      [activePreview.adapted.platformId]: {
        ...activePreview.adapted,
        ...patch,
      },
    }));
  };

  const connectAccount = (accountId: string) => {
    const targetAccount = connectedAccounts.find((account) => account.id === accountId);

    setConnectedAccounts((current) =>
      current.map((account) =>
        account.id === accountId
          ? {
              ...account,
              status: "connected",
              connectedAt: new Date().toISOString(),
            }
          : account,
      ),
    );

    if (targetAccount) {
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          `${getPlatformLabel(targetAccount.platformId)} 已确认登录。现在可以把该平台草稿发送到浏览器扩展，由扩展打开创作页并尝试填充内容。`,
        ),
      ]);
    }
  };

  const disconnectAccount = (accountId: string) => {
    const targetAccount = connectedAccounts.find((account) => account.id === accountId);

    setConnectedAccounts((current) =>
      current.map((account) =>
        account.id === accountId
          ? {
              ...account,
              status: "disconnected",
              connectedAt: undefined,
            }
          : account,
      ),
    );

    if (targetAccount) {
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          `${getPlatformLabel(targetAccount.platformId)} 已取消登录确认。发送到浏览器扩展前需要重新确认。`,
        ),
      ]);
    }
  };

  const openAccountModal = (reason: string) => {
    setAccountModalReason(reason);
    setAccountModalOpen(true);
  };

  const deliverPublishPlan = async () => {
    if (!operationPlan || !operationPlan.publishJobs.length) {
      return;
    }

    setIsPublishing(true);
    const createdAt = new Date().toISOString();

    if (!receiverUrl.trim()) {
      const blockedResults = operationPlan.publishJobs.map((job) => {
        const account = connectedAccounts.find((item) => item.id === job.accountId);

        return {
          id: `${job.id}-${Date.now()}`,
          platformId: job.platformId,
          accountName: account?.displayName ?? getPlatformLabel(job.platformId),
          status: "blocked" as const,
          executionRoute: job.executionRoute,
          message: "真实投递地址为空，未执行任何发布请求。",
          createdAt,
        };
      });

      setPublishResults(blockedResults);
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          "我没有执行发布，因为接收地址为空。请填入 webhook.site 生成的临时地址、自建后端或自动化服务的接收 URL。",
        ),
      ]);
      setIsPublishing(false);
      return;
    }

    const nextResults = await Promise.all(operationPlan.publishJobs.map(async (job) => {
      const account = connectedAccounts.find((item) => item.id === job.accountId);
      const preview = previews.find(
        (item) => item.adapted.platformId === job.platformId,
      );
      const canPublish = Boolean(preview?.validation.canPublish);

      if (!preview || !canPublish) {
        return {
          id: `${job.id}-${Date.now()}`,
          platformId: job.platformId,
          accountName: account?.displayName ?? getPlatformLabel(job.platformId),
          status: "blocked" as const,
          executionRoute: job.executionRoute,
          message: "发布体检未通过，已阻止真实投递。",
          createdAt,
          receiverUrl: receiverUrl.trim(),
        };
      }

      return deliverPreviewToReceiver({
        receiverUrl: receiverUrl.trim(),
        job,
        preview,
        accountName: account?.displayName ?? getPlatformLabel(job.platformId),
        platformName: getPlatformLabel(job.platformId),
        createdAt,
      });
    }));

    setPublishResults(nextResults);
    setMessages((current) => [
      ...current,
      createMessage(
        "assistant",
        `真实投递完成：共 ${nextResults.length} 个任务，${
          nextResults.filter((result) => result.status === "success").length
        } 个成功，${
          nextResults.filter((result) => result.status === "failed").length
        } 个失败，${
          nextResults.filter((result) => result.status === "blocked").length
        } 个被发布体检拦截。`,
      ),
    ]);
    setIsPublishing(false);
  };

  const deliverViaExtensionBridge = async () => {
    if (!operationPlan || !operationPlan.publishJobs.length) {
      return;
    }

    if (missingAccountConnections.length) {
      const createdAt = new Date().toISOString();
      const blockedResults = operationPlan.publishJobs.map((job) => {
        const account = connectedAccounts.find((item) => item.id === job.accountId);
        const needsLogin = account?.status !== "connected";

        return {
          id: `${job.id}-${Date.now()}`,
          platformId: job.platformId,
          accountName: account?.displayName ?? getPlatformLabel(job.platformId),
          status: "blocked" as const,
          executionRoute: "browser-extension",
          message: needsLogin
            ? "发送到平台创作页前，需要先确认该平台已经在浏览器完成登录。"
            : "等待其他目标平台确认登录后统一发送。",
          createdAt,
          receiverUrl: "ContentBridge Extension",
        };
      });
      const missingNames = missingAccountConnections
        .map((account) => getPlatformLabel(account.platformId))
        .join("、");

      setPublishResults(blockedResults);
      setAccountModalReason(
        `发送到浏览器扩展前，请先确认这些平台已在浏览器登录：${missingNames}。如果只是验证投递链路，可以继续使用测试接收地址。`,
      );
      setAccountModalOpen(true);
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          `我先暂停发送草稿，因为 ${missingNames} 还没有确认登录。确认后再点“发送到浏览器扩展”，我会继续打开平台创作页。`,
        ),
      ]);
      return;
    }

    setIsPublishing(true);
    const createdAt = new Date().toISOString();
    const results = await sendJobsToExtensionBridge({
      jobs: operationPlan.publishJobs.map((job) => {
        const account = connectedAccounts.find((item) => item.id === job.accountId);
        const preview = previews.find(
          (item) => item.adapted.platformId === job.platformId,
        );

        return {
          job,
          preview: preview ?? previews[0],
          accountName: account?.displayName ?? getPlatformLabel(job.platformId),
          platformName: getPlatformLabel(job.platformId),
          createdAt,
        };
      }).filter((item) => Boolean(item.preview)),
    });

    setPublishResults(results);
    setMessages((current) => [
      ...current,
      createMessage(
        "assistant",
        `浏览器扩展 Bridge 处理完成：${
          results.filter((result) => result.status === "success").length
        } 个任务已发送，${
          results.filter((result) => result.status === "failed").length
        } 个失败，${
          results.filter((result) => result.status === "blocked").length
        } 个被发布体检拦截。`,
      ),
    ]);
    setIsPublishing(false);
  };

  const agentPanel = (
    <section className="agent-card" aria-labelledby="agent-title">
      <div className="agent-heading">
        <p className="eyebrow">ContentBridge Agent</p>
        <h1 id="agent-title">你想发什么？</h1>
        <p>
          先用对话确认主题、平台和语气。生成后左边继续聊，右边实时看每个平台的改写结果。
        </p>
      </div>

      <div className="message-list" aria-live="polite">
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.id}>
            <span>{message.role === "assistant" ? "Agent" : "你"}</span>
            <p>{message.text}</p>
          </div>
        ))}
      </div>

      <div className="prompt-row" aria-label="快捷指令">
        {quickPrompts.map((prompt) => (
          <button type="button" key={prompt} onClick={() => runAgentCommand(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="account-dock"
        onClick={() =>
          openAccountModal(
            "这里不会保存账号密码，只记录你是否已经在浏览器完成平台登录。确认后才能把草稿发送到浏览器扩展。",
          )
        }
      >
        <span>发布账号</span>
        <b>
          {connectedAccounts.filter((account) => account.status === "connected").length}/
          {connectedAccounts.length} 已确认
        </b>
      </button>

      <form
        className="chat-box"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          runAgentCommand();
        }}
      >
        <textarea
          value={agentInput}
          onChange={(event) => setAgentInput(event.target.value)}
          placeholder="例如：帮我写一篇 AI 学习效率的小红书和知乎文案，语气真实一点"
          rows={4}
        />
        <button type="submit">生成预览</button>
      </form>
    </section>
  );

  return (
    <main className="preview-shell">
      <aside className="preview-chat">{agentPanel}</aside>

      <section
        className={`preview-stage ${!hasContent ? "viral-stage" : ""}`}
        aria-label="平台化改写预览"
      >
        <header className="preview-header">
          <div>
            <p className="eyebrow">
              {hasContent ? "实时平台化改写" : "平台爆品灵感库"}
            </p>
            <h2>
              {hasContent
                ? content.title
                : "先看看各平台内容为什么会火"}
            </h2>
          </div>
          {hasContent ? (
            <div className="preview-score">
              <span>{communicationScore}</span>
              <p>内容传达度</p>
            </div>
          ) : null}
        </header>

        {hasContent ? (
          <div className="flow-guide" aria-label="发布流程">
            {workflowSteps.map((step, index) => (
              <div className={step.state} key={step.label}>
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
            ))}
          </div>
        ) : null}

        {hasContent ? (
          <div className="platform-tabs" aria-label="平台切换">
            {previews.map((preview) => (
              <button
                type="button"
                className={
                  preview.adapted.platformId === activePreview?.adapted.platformId
                    ? "active"
                    : ""
                }
                key={preview.adapted.platformId}
                onClick={() => setActivePlatformId(preview.adapted.platformId)}
              >
                <span>{preview.platformName}</span>
                <b className={getScoreTone(preview.validation.score)}>
                  {preview.validation.score}
                </b>
              </button>
            ))}
          </div>
        ) : null}

        {!hasContent ? (
          <div className="viral-preview-board">
            <div className="viral-title-row">
              <h3>
                <span>一键平台化改写</span>
                <b>· 让内容在每个平台都更容易被喜欢</b>
              </h3>
              <strong>多平台内容发布工具</strong>
            </div>

            <div className="viral-card-grid" aria-label="爆款平台拆解窗口">
              {inspirationCards.map((card) => (
                <button
                  type="button"
                  className={`viral-card viral-card-${card.style}`}
                  key={card.id}
                  onClick={() => setSelectedInspiration(card)}
                  aria-label={`打开${card.category}拆解`}
                >
                  <span className="category-tab">{card.category}</span>

                  <div className="platform-window">
                    {card.style === "note" ? (
                      <>
                        <div className="note-photo" aria-hidden="true">
                          <span />
                          <i />
                        </div>
                        <div className="note-copy">
                          <h4>{card.title}</h4>
                          {card.badge ? <em>{card.badge}</em> : null}
                          <p>{card.subtitle}</p>
                          <div className="tag-row">
                            {card.tags?.map((tag) => <span key={tag}>#{tag}</span>)}
                          </div>
                        </div>
                      </>
                    ) : null}

                    {card.style === "qa" ? (
                      <div className="qa-copy">
                        <h4>
                          <span>问</span>
                          {card.title}
                        </h4>
                        <p>
                          <span>答</span>
                          {card.body[0]}
                        </p>
                        <p>{card.subtitle}</p>
                        <ol>
                          {card.body.slice(1).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ol>
                        <small>关键是把早起和正向反馈绑定，习惯就会越来越稳。</small>
                      </div>
                    ) : null}

                    {card.style === "video" ? (
                      <div className="video-copy">
                        <div className="video-cover">
                          <h4>{card.title}</h4>
                          <span className="play-button">▶</span>
                          <b>06:42</b>
                        </div>
                        <p>{card.subtitle}</p>
                      </div>
                    ) : null}

                    {card.style === "article" ? (
                      <div className="article-copy">
                        <h4>
                          {card.title}
                          {card.badge ? <em>{card.badge}</em> : null}
                        </h4>
                        <div className="article-meta">
                          {card.metrics.map((metric) => (
                            <span key={metric}>{metric}</span>
                          ))}
                        </div>
                        {card.body.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                        <div className="article-image" />
                      </div>
                    ) : null}

                    {card.style === "micro" ? (
                      <div className="micro-copy">
                        <div className="micro-author">
                          <span />
                          <p>
                            努力的小张
                            <small>30分钟前</small>
                          </p>
                          <b>...</b>
                        </div>
                        <h4>{card.title}</h4>
                        <p>{card.subtitle}</p>
                        <div className="tag-row">
                          {card.tags?.map((tag) => <span key={tag}>#{tag}</span>)}
                        </div>
                      </div>
                    ) : null}

                    {card.style === "vertical" ? (
                      <div className="vertical-copy">
                        <div className="vertical-avatar" />
                        <h4>{card.title}</h4>
                        <div className="vertical-actions">
                          {card.metrics.map((metric) => (
                            <span key={metric}>{metric}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="metric-row">
                      {card.metrics.map((metric) => (
                        <span key={metric}>{metric}</span>
                      ))}
                    </div>
                    <div className="embedded-callouts">
                      {card.callouts.map((callout) => (
                        <span key={callout.label}>
                          <b>{callout.label}</b>
                          {callout.text}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="formula-bar">
              <b>爆款内容通用公式</b>
              <span>痛点/冲突开场</span>
              <i>+</i>
              <span>解决方案/方法</span>
              <i>+</i>
              <span>真实体验/案例</span>
              <i>+</i>
              <span>行动指令/引导互动</span>
              <small>
                <b>●</b> 爆点 <b>●</b> 信任 <b>●</b> 场景 <b>●</b> 转化
              </small>
            </div>

            {selectedInspiration ? (
              <div
                className="case-dialog-backdrop"
                role="presentation"
                onClick={() => setSelectedInspiration(null)}
              >
                <section
                  className="case-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="case-dialog-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="case-dialog-close"
                    onClick={() => setSelectedInspiration(null)}
                    aria-label="关闭拆解详情"
                  >
                    ×
                  </button>
                  <p>{selectedInspiration.category}</p>
                  <h3 id="case-dialog-title">{selectedInspiration.title}</h3>
                  <strong>{selectedInspiration.detail}</strong>
                  <div>
                    {selectedInspiration.callouts.map((callout) => (
                      <article key={callout.label}>
                        <span>{callout.label}</span>
                        <p>{callout.text}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        ) : activePreview ? (
          <div className="platform-preview">
            <div className="preview-editor">
              <label>
                标题
                <input
                  value={activePreview.adapted.title}
                  onChange={(event) =>
                    updateActivePreview({ title: event.target.value })
                  }
                />
              </label>
              <label>
                正文
                <textarea
                  value={activePreview.adapted.body}
                  onChange={(event) => updateActivePreview({ body: event.target.value })}
                  rows={14}
                />
              </label>
              <label>
                标签
                <input
                  value={activePreview.adapted.tags.join("，")}
                  onChange={(event) =>
                    updateActivePreview({
                      tags: event.target.value
                        .split(/[,，]/)
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            </div>

            <aside className="preview-insight">
              <div className={`health-card ${getScoreTone(activePreview.validation.score)}`}>
                <span>{activePreview.validation.score}</span>
                <p>{activePreview.validation.canPublish ? "可发布" : "需修改"}</p>
              </div>
              {operationPlan ? (
                <>
                  <section className="hotspot-plan-card">
                    <h3>Agent 热点洞察</h3>
                    <div className="signal-stack">
                      {operationPlan.hotspotSignals.slice(0, 3).map((signal) => (
                        <article key={`${signal.platformId}-${signal.angle}`}>
                          <span>{getPlatformLabel(signal.platformId)}</span>
                          <strong>{signal.angle}</strong>
                          <p>{signal.reason}</p>
                          <small>{signal.rewriteHint}</small>
                        </article>
                      ))}
                    </div>
                  </section>
                  <MatrixDeliveryPanel
                    desiredAccountConnections={desiredAccountConnections}
                    missingAccountConnections={missingAccountConnections}
                    receiverUrl={receiverUrl}
                    isPublishing={isPublishing}
                    publishJobsLength={operationPlan.publishJobs.length}
                    publishResults={publishResults}
                    getPlatformLabel={getPlatformLabel}
                    getAccountStatusLabel={(status) => accountStatusLabel[status]}
                    getPublishResultLabel={(status) => publishResultLabel[status]}
                    onOpenAccountModal={openAccountModal}
                    onReceiverUrlChange={setReceiverUrl}
                    onDeliver={() => {
                      void deliverPublishPlan();
                    }}
                    onDeliverToExtension={() => {
                      void deliverViaExtensionBridge();
                    }}
                  />
                </>
              ) : null}
              <section>
                <h3>{activePreview.platformName} 改写策略</h3>
                <p>{activePreview.contentStrategy}</p>
                <ul>
                  {activePreview.adapted.strategyNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>需要注意</h3>
                {activePreview.validation.issues.length ? (
                  <ul>
                    {activePreview.validation.issues.map((issue) => (
                      <li key={issue.message}>{issue.message}</li>
                    ))}
                  </ul>
                ) : (
                  <p>当前版本没有明显发布风险，可以继续微调语气或标题。</p>
                )}
              </section>
            </aside>
          </div>
        ) : (
          <div className="empty-preview">先在左侧告诉 Agent 你要发布的主题。</div>
        )}
      </section>
      {accountModalOpen ? (
        <div className="account-modal-backdrop" onClick={() => setAccountModalOpen(false)}>
          <section
            className="account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="case-dialog-close"
              onClick={() => setAccountModalOpen(false)}
              aria-label="关闭账号连接"
            >
              ×
            </button>
            <p className="eyebrow">发布账号</p>
            <h3 id="account-modal-title">确认平台登录状态</h3>
            <strong>{accountModalReason}</strong>
            <div className="account-modal-grid">
              {modalAccounts.map((account) => (
                <article
                  key={account.id}
                  className={[
                    account.status === "connected" ? "connected" : "",
                    selectedPlatformSet.has(account.platformId) ? "target" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div>
                    <span>{getPlatformLabel(account.platformId)}</span>
                    {selectedPlatformSet.has(account.platformId) ? (
                      <em>本次需要</em>
                    ) : null}
                    <b>{accountStatusLabel[account.status]}</b>
                  </div>
                  <h4>{account.displayName}</h4>
                  <p>{account.persona}</p>
                  <ul>
                    <li>受众：{account.audience}</li>
                    <li>连接方式：{authModeLabel[account.authMode]}</li>
                    <li>日发布上限：{account.dailyPostLimit} 条</li>
                  </ul>
                  <div className="account-action-row">
                    <a
                      href={account.loginUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        if (account.status !== "connected") {
                          setMessages((current) => [
                            ...current,
                            createMessage(
                              "assistant",
                              `已为你打开 ${getPlatformLabel(
                                account.platformId,
                              )} 的登录/创作入口。登录完成后回到这里点“确认已登录”，我才会把草稿发送到浏览器扩展。`,
                            ),
                          ]);
                        }
                      }}
                    >
                      {account.loginLabel}
                    </a>
                    {account.status === "connected" ? (
                      <button type="button" onClick={() => disconnectAccount(account.id)}>
                        断开连接
                      </button>
                    ) : (
                      <button type="button" onClick={() => connectAccount(account.id)}>
                        确认已登录
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;

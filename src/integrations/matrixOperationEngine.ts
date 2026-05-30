import type { ContentInput } from "../types/content";

export type MatrixPlatformId =
  | "xiaohongshu"
  | "douyin"
  | "kuaishou"
  | "bilibili"
  | "wechat"
  | "zhihu"
  | "weibo"
  | "tiktok";

export type AuthMode = "official-oauth" | "browser-session" | "cookie-vault";

export type AccountChannel = {
  id: string;
  platformId: MatrixPlatformId;
  displayName: string;
  persona: string;
  audience: string;
  contentAngles: string[];
  authMode: AuthMode;
  canSchedule: boolean;
  canAutoUpload: boolean;
  dailyPostLimit: number;
};

export type HotspotCrawlTask = {
  platformId: MatrixPlatformId;
  keyword: string;
  crawlerType: "keyword-search" | "creator-feed" | "comment-mining";
  maxItems: number;
  purpose: string;
};

export type HotspotSignal = {
  platformId: MatrixPlatformId;
  angle: string;
  reason: string;
  rewriteHint: string;
};

export type PublishJob = {
  id: string;
  accountId: string;
  platformId: MatrixPlatformId;
  authMode: AuthMode;
  title: string;
  assetRequirement: "text" | "cover" | "video";
  scheduledAt: string;
  status: "draft" | "needs-confirmation" | "ready";
  executionRoute: "official-api" | "browser-automation" | "manual-export";
};

export type AgentOperationPlan = {
  topic: string;
  matchedAccounts: AccountChannel[];
  hotspotTasks: HotspotCrawlTask[];
  hotspotSignals: HotspotSignal[];
  publishJobs: PublishJob[];
  guardrails: string[];
};

export const integrationBlueprints = [
  {
    id: "account-channel",
    problem: "矩阵运营需要同时管理多个平台账号、发布节奏和授权状态。",
    method:
      "将平台账号抽象为 AccountChannel，由发布计划引用具体账号通道。",
    appliedAs:
      "AccountChannel 使用 official-oauth、browser-session、cookie-vault 三种授权模式，并保留 canSchedule 与 dailyPostLimit。",
  },
  {
    id: "hotspot-crawler",
    problem: "Agent 生成内容前需要理解平台热点、评论痛点和同类主题表达。",
    method:
      "将热点搜索、创作者观察和评论挖掘统一抽象为 HotspotCrawlTask。",
    appliedAs:
      "HotspotCrawlTask 只描述采集意图和限流参数，真实抓取可由本地 worker 或后端沙盒执行。",
  },
  {
    id: "upload-runner",
    problem: "不同平台需要不同的媒体素材、登录状态、发布时间和确认流程。",
    method:
      "将一次待发布动作抽象为 PublishJob，并按平台能力选择执行路径。",
    appliedAs:
      "PublishJob 根据平台能力选择 official-api、browser-automation 或 manual-export，默认先进入 needs-confirmation。",
  },
] as const;

export const demoAccountChannels: AccountChannel[] = [
  {
    id: "xhs-study-note",
    platformId: "xiaohongshu",
    displayName: "小红书学习种草号",
    persona: "真实体验、清单收藏、轻种草",
    audience: "大学生、考研党、效率工具尝鲜用户",
    contentAngles: ["真实体验", "避坑清单", "方法步骤", "收藏模板"],
    authMode: "browser-session",
    canSchedule: true,
    canAutoUpload: true,
    dailyPostLimit: 3,
  },
  {
    id: "douyin-hook-video",
    platformId: "douyin",
    displayName: "抖音短视频口播号",
    persona: "强钩子、快节奏、行动指令",
    audience: "泛学习用户、短视频信息流用户",
    contentAngles: ["前5秒钩子", "三步方法", "反常识", "跟练脚本"],
    authMode: "browser-session",
    canSchedule: true,
    canAutoUpload: true,
    dailyPostLimit: 5,
  },
  {
    id: "bili-tutorial",
    platformId: "bilibili",
    displayName: "B站教程测评号",
    persona: "过程展示、参数分享、完整教程",
    audience: "学生、工具党、教程搜索用户",
    contentAngles: ["完整测评", "教程分章", "参数对比", "复盘案例"],
    authMode: "cookie-vault",
    canSchedule: true,
    canAutoUpload: true,
    dailyPostLimit: 2,
  },
  {
    id: "kuaishou-local-life",
    platformId: "kuaishou",
    displayName: "快手生活技巧号",
    persona: "接地气、强结果、低门槛",
    audience: "下沉市场、生活技巧用户",
    contentAngles: ["省钱技巧", "快速上手", "前后对比", "真实案例"],
    authMode: "browser-session",
    canSchedule: true,
    canAutoUpload: true,
    dailyPostLimit: 4,
  },
  {
    id: "zhihu-expert-answer",
    platformId: "zhihu",
    displayName: "知乎专业回答号",
    persona: "结论前置、逻辑拆解、可信建议",
    audience: "搜索型用户、知识决策用户",
    contentAngles: ["问题拆解", "判断标准", "反例边界", "经验总结"],
    authMode: "official-oauth",
    canSchedule: false,
    canAutoUpload: false,
    dailyPostLimit: 2,
  },
];

const platformAssetRequirement: Record<MatrixPlatformId, PublishJob["assetRequirement"]> = {
  xiaohongshu: "cover",
  douyin: "video",
  kuaishou: "video",
  bilibili: "video",
  wechat: "cover",
  zhihu: "text",
  weibo: "cover",
  tiktok: "video",
};

const normalizeTopic = (content: ContentInput) =>
  content.title.replace(/：.*$/, "").replace(/，.*$/, "").trim() ||
  content.body.slice(0, 28) ||
  "待发布主题";

const inferKeyword = (content: ContentInput) => {
  const source = `${content.title} ${content.body} ${content.tags.join(" ")}`;

  if (/AI|工具|效率|学习/.test(source)) {
    return "AI 学习效率";
  }
  if (/自律|习惯|早起|拖延/.test(source)) {
    return "自律习惯";
  }
  if (/拍摄|视频|剪辑|口播/.test(source)) {
    return "短视频拍摄";
  }

  return normalizeTopic(content);
};

const getExecutionRoute = (account: AccountChannel): PublishJob["executionRoute"] => {
  if (account.authMode === "official-oauth") {
    return "official-api";
  }

  if (account.canAutoUpload) {
    return "browser-automation";
  }

  return "manual-export";
};

export const selectAccountChannels = (
  content: ContentInput,
  accounts: AccountChannel[] = demoAccountChannels,
) => {
  const selected = new Set(content.selectedPlatformIds);
  const source = `${content.title} ${content.body} ${content.tags.join(" ")}`;

  return accounts.filter((account) => {
    const platformMatched =
      selected.size === 0 || selected.has(account.platformId);
    const angleMatched = account.contentAngles.some((angle) => source.includes(angle));
    const broadVideoMatched =
      /短视频|视频|口播|拍摄/.test(source) &&
      ["douyin", "kuaishou", "bilibili", "tiktok"].includes(account.platformId);
    const broadStudyMatched =
      /AI|学习|效率|工具|自律/.test(source) &&
      ["xiaohongshu", "zhihu", "bilibili", "douyin"].includes(account.platformId);

    return platformMatched && (angleMatched || broadVideoMatched || broadStudyMatched);
  });
};

export const buildHotspotCrawlPlan = (
  content: ContentInput,
  accounts: AccountChannel[] = demoAccountChannels,
): HotspotCrawlTask[] => {
  const keyword = inferKeyword(content);
  const platforms = [...new Set(accounts.map((account) => account.platformId))];

  return platforms.flatMap((platformId) => [
    {
      platformId,
      keyword,
      crawlerType: "keyword-search" as const,
      maxItems: 20,
      purpose: "找相似爆款标题、封面表达和高互动主题",
    },
    {
      platformId,
      keyword,
      crawlerType: "comment-mining" as const,
      maxItems: 50,
      purpose: "提取评论区痛点、反对意见和二次选题",
    },
  ]);
};

export const extractHotspotSignals = (
  tasks: HotspotCrawlTask[],
): HotspotSignal[] => {
  const platformIds = [...new Set(tasks.map((task) => task.platformId))];

  return platformIds.map((platformId) => {
    if (platformId === "xiaohongshu") {
      return {
        platformId,
        angle: "真实体验 + 收藏清单",
        reason: "小红书更容易被收藏的内容通常有场景、亲测过程和可复用清单。",
        rewriteHint: "标题写成亲测结果，正文保留生活场景和避坑提醒。",
      };
    }

    if (["douyin", "kuaishou", "tiktok"].includes(platformId)) {
      return {
        platformId,
        angle: "前5秒钩子 + 明确行动",
        reason: "短视频先看停留，再看完播，开头必须快速给出痛点或结果。",
        rewriteHint: "生成口播脚本、画面提示和结尾关注/收藏动作。",
      };
    }

    if (platformId === "bilibili") {
      return {
        platformId,
        angle: "教程承诺 + 过程展示",
        reason: "B站教程类内容需要标题封面承诺收益，正文用章节承接完整过程。",
        rewriteHint: "补充分章标题、视频简介、参数说明和三连引导。",
      };
    }

    return {
      platformId,
      angle: "问题拆解 + 结论前置",
      reason: "搜索型平台更关注可信解释、判断标准和结构清晰度。",
      rewriteHint: "把内容改成问题标题、结论先行和分点论证。",
    };
  });
};

export const createPublishJobs = (
  content: ContentInput,
  accounts: AccountChannel[],
  startAt = new Date("2026-05-30T18:00:00+08:00"),
): PublishJob[] =>
  accounts.map((account, index) => {
    const scheduledAt = new Date(startAt.getTime() + index * 90 * 60 * 1000);

    return {
      id: `job-${account.id}-${index + 1}`,
      accountId: account.id,
      platformId: account.platformId,
      authMode: account.authMode,
      title: normalizeTopic(content),
      assetRequirement: platformAssetRequirement[account.platformId],
      scheduledAt: scheduledAt.toISOString(),
      status: "needs-confirmation",
      executionRoute: getExecutionRoute(account),
    };
  });

export const buildAgentOperationPlan = (
  content: ContentInput,
  accounts: AccountChannel[] = demoAccountChannels,
): AgentOperationPlan => {
  const matchedAccounts = selectAccountChannels(content, accounts);
  const fallbackAccounts = matchedAccounts.length
    ? matchedAccounts
    : accounts.filter((account) => content.selectedPlatformIds.includes(account.platformId));
  const targetAccounts = fallbackAccounts.length ? fallbackAccounts : accounts.slice(0, 3);
  const hotspotTasks = buildHotspotCrawlPlan(content, targetAccounts);

  return {
    topic: normalizeTopic(content),
    matchedAccounts: targetAccounts,
    hotspotTasks,
    hotspotSignals: extractHotspotSignals(hotspotTasks),
    publishJobs: createPublishJobs(content, targetAccounts),
    guardrails: [
      "默认只生成待确认任务，不直接发布。",
      "账号授权优先走官方 OAuth；国内短视频平台自动化上传必须使用用户自有登录态。",
      "热点采集需要限流、去重和来源记录，不做大规模抓取。",
      "不同账号必须改写标题、开头和 CTA，避免矩阵内容重复。",
    ],
  };
};

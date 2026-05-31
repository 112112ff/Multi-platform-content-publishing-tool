import type { AccountChannel, MatrixPlatformId } from "../integrations/matrixOperationEngine";
import type { ContentInput } from "../types/content";

export type ProductPlatformId =
  | "wechat"
  | "zhihu"
  | "bilibili"
  | "xiaohongshu"
  | "weibo"
  | "douyin";

export type PlatformCatalogItem = {
  id: ProductPlatformId;
  name: string;
  shortName: string;
  loginUrl: string;
  creatorUrl: string;
  loginLabel: string;
  accountName: string;
  persona: string;
  audience: string;
  promise: string;
  aliases: string[];
};

export type AgentPlan = {
  platform: PlatformCatalogItem;
  content: ContentInput;
  reply: string;
  needsAccount: boolean;
  source?: "local" | "minimax";
};

export type RemoteAgentPlan = {
  platformId?: string;
  title?: string;
  body?: string;
  tags?: string[];
  reply?: string;
  coverUrl?: string;
  videoUrl?: string;
};

export const platformCatalog: PlatformCatalogItem[] = [
  {
    id: "xiaohongshu",
    name: "小红书",
    shortName: "小红书",
    loginUrl: "https://creator.xiaohongshu.com/",
    creatorUrl: "https://creator.xiaohongshu.com/publish/publish",
    loginLabel: "打开小红书创作服务平台",
    accountName: "小红书内容账号",
    persona: "真实体验、清单收藏、轻种草",
    audience: "生活方式、学习成长和消费决策用户",
    promise: "把内容改成更像笔记的标题、分段和标签",
    aliases: ["小红书", "种草", "笔记", "生活方式", "收藏"],
  },
  {
    id: "zhihu",
    name: "知乎",
    shortName: "知乎",
    loginUrl: "https://www.zhihu.com/signin",
    creatorUrl: "https://www.zhihu.com/write",
    loginLabel: "打开知乎登录",
    accountName: "知乎回答账号",
    persona: "结论前置、逻辑拆解、可信建议",
    audience: "搜索型用户、知识决策用户",
    promise: "把内容改成问答结构和可验证的论证",
    aliases: ["知乎", "问答", "回答", "专业", "分析"],
  },
  {
    id: "bilibili",
    name: "B站",
    shortName: "B站",
    loginUrl: "https://member.bilibili.com/platform/home",
    creatorUrl: "https://member.bilibili.com/platform/upload/video/frame",
    loginLabel: "打开 B站创作中心",
    accountName: "B站视频账号",
    persona: "教程拆解、章节清晰、三连引导",
    audience: "教程搜索用户、工具学习用户",
    promise: "把内容改成视频简介、分章和标题封面要点",
    aliases: ["B站", "哔哩哔哩", "bilibili", "视频教程", "三连"],
  },
  {
    id: "wechat",
    name: "公众号",
    shortName: "公众号",
    loginUrl: "https://mp.weixin.qq.com/",
    creatorUrl: "https://mp.weixin.qq.com/",
    loginLabel: "打开微信公众号后台",
    accountName: "公众号内容账号",
    persona: "长文结构、专业背书、私域沉淀",
    audience: "深度阅读用户、品牌私域用户",
    promise: "把内容改成长文导语、层级标题和行动清单",
    aliases: ["公众号", "微信", "长文", "私域", "文章"],
  },
  {
    id: "weibo",
    name: "微博",
    shortName: "微博",
    loginUrl: "https://weibo.com/login.php",
    creatorUrl: "https://weibo.com/",
    loginLabel: "打开微博登录",
    accountName: "微博互动账号",
    persona: "短观点、话题参与、转评互动",
    audience: "热点浏览用户、轻内容用户",
    promise: "把内容压缩成短观点和话题标签",
    aliases: ["微博", "热搜", "话题", "短观点"],
  },
  {
    id: "douyin",
    name: "抖音",
    shortName: "抖音",
    loginUrl: "https://creator.douyin.com/",
    creatorUrl: "https://creator.douyin.com/creator-micro/content/upload",
    loginLabel: "打开抖音创作者中心",
    accountName: "抖音短视频账号",
    persona: "强钩子、快节奏、行动指令",
    audience: "短视频信息流用户、泛学习用户",
    promise: "把内容改成口播脚本、镜头提示和强开头",
    aliases: ["抖音", "短视频", "口播", "竖屏", "爆款视频"],
  },
];

export const accountChannels: AccountChannel[] = platformCatalog.map((platform) => ({
  id: `${platform.id}-primary`,
  platformId: platform.id as MatrixPlatformId,
  displayName: platform.accountName,
  persona: platform.persona,
  audience: platform.audience,
  contentAngles: platform.aliases,
  authMode:
    platform.id === "wechat" || platform.id === "zhihu" || platform.id === "weibo"
      ? "official-oauth"
      : "browser-session",
  canSchedule: true,
  canAutoUpload:
    platform.id === "xiaohongshu" ||
    platform.id === "douyin" ||
    platform.id === "bilibili",
  dailyPostLimit: platform.id === "weibo" ? 8 : platform.id === "douyin" ? 5 : 3,
}));

export const getPlatformById = (platformId: string) =>
  platformCatalog.find((platform) => platform.id === platformId) ?? platformCatalog[0];

export const inferPlatform = (prompt: string): PlatformCatalogItem => {
  const normalized = prompt.toLowerCase();
  const matched = platformCatalog.find((platform) =>
    platform.aliases.some((alias) => normalized.includes(alias.toLowerCase())),
  );

  if (matched) {
    return matched;
  }

  if (/视频|口播|镜头|脚本|爆款/.test(prompt)) {
    return getPlatformById("douyin");
  }

  if (/专业|分析|知识|问题|为什么|如何/.test(prompt)) {
    return getPlatformById("zhihu");
  }

  if (/长文|深度|私域|品牌/.test(prompt)) {
    return getPlatformById("wechat");
  }

  return getPlatformById("xiaohongshu");
};

const cleanPrompt = (prompt: string) =>
  prompt
    .replace(/帮我|请|我要|想要|生成|写一篇|做一篇|发布到|发到/g, " ")
    .replace(/小红书|知乎|B站|哔哩哔哩|公众号|微信|微博|抖音|短视频|长文/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildBody = (topic: string, platform: PlatformCatalogItem) => {
  if (platform.id === "douyin") {
    return [
      `开场 3 秒：如果你也在为「${topic}」卡住，先别急着重做，先看这三个动作。`,
      "第一步，把目标说清楚，只保留一个最重要的结果。",
      "第二步，把复杂流程拆成今天就能做的一件小事。",
      "第三步，发布前检查标题、场景和行动指令，避免内容看起来像普通复制粘贴。",
      "结尾：想要我把这套流程做成模板，可以先收藏，下一条直接照着用。",
    ].join("\n\n");
  }

  if (platform.id === "zhihu") {
    return [
      `结论先说：${topic} 的关键不是多做，而是把判断标准和执行步骤分开。`,
      "很多人卡住，是因为一开始就想一次性完成所有平台的表达。更稳的方式是先确定核心观点，再根据平台语境重写标题、开头和行动建议。",
      "具体可以分三步：第一，明确受众真正关心的问题；第二，把内容压缩成一个清晰结论；第三，补充例子、边界和可执行清单。",
      "这样做的好处是，内容既保留原始观点，又不会在不同平台显得生硬。",
    ].join("\n\n");
  }

  if (platform.id === "wechat") {
    return [
      `今天想聊聊「${topic}」。它看起来是一个内容发布问题，本质上是创作者如何降低多平台表达成本的问题。`,
      "第一，先确定核心观点。不要一开始就复制到所有平台，而是先把这篇内容真正想解决的问题写清楚。",
      "第二，按平台重组结构。长文平台需要完整逻辑，社区平台需要真实场景，短视频平台需要更快进入冲突。",
      "第三，发布前做一次体检：标题是否清楚，正文是否有层次，结尾是否有明确行动。",
      "当这三件事稳定下来，多平台发布才不是机械搬运，而是有策略的内容分发。",
    ].join("\n\n");
  }

  if (platform.id === "weibo") {
    return [
      `${topic} 最容易被忽略的一点：不是所有平台都适合同一段话。`,
      "先提炼一个观点，再给一个场景，最后留一个讨论入口，传播效率会比直接搬运高很多。",
      "你更喜欢先写完整长文，再拆成短内容，还是一开始就按平台分别写？",
    ].join("\n\n");
  }

  if (platform.id === "bilibili") {
    return [
      `本期视频主题：${topic}`,
      "00:00 为什么多平台内容不能直接复制",
      "01:10 如何先提炼一个核心观点",
      "03:20 不同平台的标题、正文和标签怎么改",
      "05:40 发布前检查：素材、封面、简介和互动引导",
      "如果你也想提升内容分发效率，可以把这期作为发布前检查清单。",
    ].join("\n\n");
  }

  return [
    `${topic} 这件事，我建议你先别急着到处复制发布。`,
    "我自己更喜欢先把核心观点写成一句话，再根据平台重新组织表达。这样内容不会像硬搬运，读起来也更像原生笔记。",
    "可以照这个顺序来：先写痛点，再写方法，最后给一个可以马上照做的小清单。",
    "发布前再检查三件事：标题是不是一眼能懂，正文有没有真实场景，标签是不是和目标人群有关。",
  ].join("\n\n");
};

const buildTags = (topic: string, platform: PlatformCatalogItem) => {
  const topicTag = topic.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").slice(0, 10) || "内容创作";
  const base = [topicTag, "内容创作", "效率工具"];

  if (platform.id === "douyin" || platform.id === "bilibili") {
    return [...base, "短视频脚本", "创作者工具"];
  }

  if (platform.id === "zhihu") {
    return [...base, "经验分享", "方法论"];
  }

  if (platform.id === "wechat") {
    return [...base, "深度文章", "运营方法"];
  }

  return [...base, "真实体验", "发布技巧"];
};

export const buildAgentPlan = (
  prompt: string,
  previousContent?: ContentInput,
): AgentPlan => {
  const platform = inferPlatform(prompt);
  const topic =
    cleanPrompt(prompt) ||
    previousContent?.title?.replace(/[:：].*$/, "").trim() ||
    "AI 工具提升学习效率";
  const wantsShort = /短一点|精简|简短|微博|口播/.test(prompt);
  const titlePrefix =
    platform.id === "zhihu"
      ? "如何看待"
      : platform.id === "douyin"
        ? "3 个马上能用的方法："
        : platform.id === "wechat"
          ? "一篇讲透："
          : "";
  const title = `${titlePrefix}${topic}`.slice(0, platform.id === "weibo" ? 38 : 64);
  const body = buildBody(topic, platform);

  return {
    platform,
    needsAccount: true,
    source: "local",
    content: {
      title,
      body: wantsShort ? body.split("\n\n").slice(0, 3).join("\n\n") : body,
      tags: buildTags(topic, platform),
      coverUrl: previousContent?.coverUrl ?? "",
      videoUrl: previousContent?.videoUrl ?? "",
      selectedPlatformIds: [platform.id],
    },
    reply: `我判断这次先发 ${platform.name} 最合适，因为它更适合「${platform.promise}」。我已经生成单平台草稿，下一步只需要确认 ${platform.name} 账号已登录，然后点一键发布到平台草稿。`,
  };
};

export const buildAgentPlanFromRemote = (
  remote: RemoteAgentPlan,
  prompt: string,
  previousContent?: ContentInput,
): AgentPlan => {
  const fallback = buildAgentPlan(prompt, previousContent);
  const platform = getPlatformById(remote.platformId ?? fallback.platform.id);
  const tags =
    Array.isArray(remote.tags) && remote.tags.length
      ? remote.tags.map((tag) => String(tag)).filter(Boolean).slice(0, 8)
      : fallback.content.tags;

  return {
    platform,
    needsAccount: true,
    source: "minimax",
    content: {
      title: remote.title?.trim() || fallback.content.title,
      body: remote.body?.trim() || fallback.content.body,
      tags,
      coverUrl: remote.coverUrl ?? previousContent?.coverUrl ?? "",
      videoUrl: remote.videoUrl ?? previousContent?.videoUrl ?? "",
      selectedPlatformIds: [platform.id],
    },
    reply:
      remote.reply?.trim() ||
      `发布助理已为你生成 ${platform.name} 单平台草稿。确认账号登录后即可进入一键发布。`,
  };
};

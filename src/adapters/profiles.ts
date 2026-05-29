import type { PlatformProfile } from "../types/platform";

export const platformProfiles: Record<string, PlatformProfile> = {
  wechat: {
    id: "wechat",
    name: "公众号",
    positioning: "深度阅读与品牌表达",
    contentStrategy: "结构化长文、摘要、小标题和关注引导",
    tone: "正式、清晰、可信",
    publishRisks: ["标题过长", "缺少封面图", "段落结构不清晰"],
  },
  zhihu: {
    id: "zhihu",
    name: "知乎",
    positioning: "观点讨论与经验分享",
    contentStrategy: "明确观点、逻辑分层、问题意识和讨论引导",
    tone: "理性、专业、有论证",
    publishRisks: ["论点不明确", "缺少事实支撑", "结尾缺少讨论引导"],
  },
  bilibili: {
    id: "bilibili",
    name: "B站",
    positioning: "视频内容分发与社区互动",
    contentStrategy: "视频简介、分区建议、标签和互动引导",
    tone: "直接、轻松、有互动感",
    publishRisks: ["缺少视频链接", "简介过长", "标签不足"],
  },
  xiaohongshu: {
    id: "xiaohongshu",
    name: "小红书",
    positioning: "生活方式种草与移动端快速阅读",
    contentStrategy: "短句表达、场景化描述、话题标签和行动建议",
    tone: "口语化、轻快、有分享感",
    publishRisks: ["标题过长", "标签不足", "正文段落太长"],
  },
};

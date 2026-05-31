import type { ContentInput, ValidationIssue } from "../types/content";
import type { PlatformAdapter } from "../types/platform";
import {
  buildAdaptedContent,
  createDraftPublishResult,
  createSummary,
  createValidationResult,
  extractKeyPoints,
  extractTopic,
  splitParagraphs,
  uniqueTags,
} from "./adapterUtils";
import { platformProfiles } from "./profiles";

export const wechatAdapter: PlatformAdapter = {
  id: "wechat",
  name: platformProfiles.wechat.name,
  profile: platformProfiles.wechat,
  adapt(input: ContentInput) {
    const paragraphs = splitParagraphs(input.body);
    const topic = extractTopic(input);
    const keyPoints = extractKeyPoints(input, 4);
    const body = [
      `导语：${topic} 不是一个只能停留在表层讨论的话题，它背后真正值得拆解的是方法、结构和可复用经验。`,
      "## 一、为什么这个话题值得关注",
      paragraphs[0] ?? createSummary(input.body, 90),
      "## 二、可以直接采用的实践方法",
      keyPoints.map((point, index) => `**${index + 1}. ${point}**\n\n这部分可以作为读者理解 ${topic} 的一个切入点，发布时建议补充案例或数据，让观点更可信。`).join("\n\n"),
      "## 三、给创作者的发布建议",
      "公众号版本适合保留完整逻辑：开头提出判断，中段分层展开，结尾给出行动清单。发布前建议搭配清晰封面图，并在结尾引导读者收藏、转发或关注。",
    ].join("\n\n");

    return buildAdaptedContent("wechat", `一篇讲透：${topic}`.slice(0, 64), body, input, {
      summary: createSummary(input.body, 80),
      tags: uniqueTags(input.tags, ["图文", "深度阅读"]),
      strategyNotes: [
        "公众号版本强化了导语、小标题和结尾引导，适合完整阅读。",
        "正文被整理为更清晰的长图文结构，便于读者收藏和转发。",
      ],
    });
  },
  validate(content, input) {
    const issues: ValidationIssue[] = [];
    if (content.title.length > 64) {
      issues.push({
        level: "warning",
        message: "公众号标题偏长。",
        suggestion: "建议控制在 64 字以内，提高列表页可读性。",
      });
    }
    if (!input.coverUrl) {
      issues.push({
        level: "warning",
        message: "缺少封面图。",
        suggestion: "公众号图文建议配置封面图，提升打开率。",
      });
    }
    return createValidationResult(issues.length ? 86 : 94, issues);
  },
  async publish(content, validation) {
    return createDraftPublishResult(content, validation.score, validation.canPublish);
  },
};

import type { ContentInput, ValidationIssue } from "../types/content";
import type { PlatformAdapter } from "../types/platform";
import {
  buildAdaptedContent,
  createDraftPublishResult,
  createSummary,
  createValidationResult,
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
    const body = [
      `导语：${createSummary(input.body, 70)}`,
      "## 一、为什么这个话题值得关注",
      paragraphs[0] ?? "先输入原始正文，系统会生成公众号长文结构。",
      "## 二、可以直接采用的实践方法",
      paragraphs.slice(1, 3).join("\n\n") || "这里会整理成适合图文阅读的分点说明。",
      "## 三、发布前建议",
      "建议搭配清晰封面图，并在结尾引导读者收藏、转发或关注。",
    ].join("\n\n");

    return buildAdaptedContent("wechat", input.title || "公众号图文标题", body, input, {
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
    return createDraftPublishResult(content, validation.score);
  },
};

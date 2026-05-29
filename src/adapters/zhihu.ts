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

export const zhihuAdapter: PlatformAdapter = {
  id: "zhihu",
  name: platformProfiles.zhihu.name,
  profile: platformProfiles.zhihu,
  adapt(input: ContentInput) {
    const paragraphs = splitParagraphs(input.body);
    const title = input.title.endsWith("？")
      ? input.title
      : `${input.title || "这个问题"}，真正有效的方法是什么？`;
    const body = [
      "我的结论是：工具本身不是关键，关键是把它放进正确的流程。",
      "### 背景",
      paragraphs[0] ?? "输入正文后，知乎版本会突出问题意识和观点表达。",
      "### 分析",
      paragraphs.slice(1, 4).join("\n\n") || "这里会保留原文论据，并整理成更适合讨论的结构。",
      "### 可讨论的问题",
      "你认为这套方法最难坚持的环节是什么？欢迎在评论区补充不同经验。",
    ].join("\n\n");

    return buildAdaptedContent("zhihu", title, body, input, {
      summary: createSummary(body, 90),
      tags: uniqueTags(input.tags, ["经验分享", "方法论"]),
      strategyNotes: [
        "知乎版本强化了观点、论证和讨论式结尾。",
        "标题被改成问题式表达，更容易进入问答社区语境。",
      ],
    });
  },
  validate(content) {
    const issues: ValidationIssue[] = [];
    if (!content.body.includes("结论")) {
      issues.push({
        level: "info",
        message: "知乎回答建议先给出明确观点。",
        suggestion: "可以在开头补充一句核心结论。",
      });
    }
    return createValidationResult(90, issues);
  },
  async publish(content, validation) {
    return createDraftPublishResult(content, validation.score);
  },
};

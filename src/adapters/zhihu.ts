import type { ContentInput, ValidationIssue } from "../types/content";
import type { PlatformAdapter } from "../types/platform";
import {
  buildAdaptedContent,
  createDraftPublishResult,
  createSummary,
  createValidationResult,
  extractKeyPoints,
  extractTopic,
  numberedList,
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
    const topic = extractTopic(input);
    const keyPoints = extractKeyPoints(input, 4);
    const title = topic.endsWith("？")
      ? topic
      : `如何看待${topic}？有哪些值得借鉴的判断？`;
    const body = [
      `我的结论是：讨论「${topic}」不能只看表面结果，更要看它背后的结构、约束和可迁移方法。`,
      "### 背景",
      paragraphs[0] ?? "输入正文后，知乎版本会突出问题意识和观点表达。",
      "### 分析",
      numberedList(keyPoints),
      "### 边界",
      "这些经验并不是所有场景都能照搬，真正重要的是判断自己的资源、目标用户和执行周期是否匹配。",
      "### 可讨论的问题",
      `你认为 ${topic} 最值得普通创作者或团队借鉴的是哪一点？欢迎补充不同经验。`,
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
    return createDraftPublishResult(content, validation.score, validation.canPublish);
  },
};

import type { ContentInput, ValidationIssue } from "../types/content";
import type { PlatformAdapter } from "../types/platform";
import {
  buildAdaptedContent,
  createDraftPublishResult,
  extractKeyPoints,
  extractTopic,
  createSummary,
  createValidationResult,
  uniqueTags,
} from "./adapterUtils";
import { platformProfiles } from "./profiles";

export const xiaohongshuAdapter: PlatformAdapter = {
  id: "xiaohongshu",
  name: platformProfiles.xiaohongshu.name,
  profile: platformProfiles.xiaohongshu,
  adapt(input: ContentInput) {
    const topic = extractTopic(input);
    const title = `${topic}｜这几个点值得收藏`.slice(0, 32);
    const shortLines = extractKeyPoints(input, 5).map((line) => `- ${line}`);
    const tags = uniqueTags(input.tags, [topic.slice(0, 8), "经验分享", "收藏清单"]);
    const body = [
      `最近整理 ${topic}，发现最值得记住的是这几件事：`,
      ...shortLines,
      "",
      "我的建议是：先收藏，再按自己的场景挑 1 个点试起来。",
      tags.map((tag) => `#${tag}`).join(" "),
    ].join("\n");

    return buildAdaptedContent("xiaohongshu", title, body, input, {
      summary: "笔记已转换为短句、场景化表达和话题标签。",
      tags,
      strategyNotes: [
        "小红书版本拆成短句，更适合移动端快速阅读。",
        "补充了话题标签和亲测语气，增强种草感。",
      ],
    });
  },
  validate(content) {
    const issues: ValidationIssue[] = [];
    if (content.title.length > 28) {
      issues.push({
        level: "warning",
        message: "小红书标题略长。",
        suggestion: "建议控制在 28 字以内，增强列表页吸引力。",
      });
    }
    if (content.tags.length < 3) {
      issues.push({
        level: "warning",
        message: "话题标签偏少。",
        suggestion: "建议至少配置 3 个话题标签。",
      });
    }
    return createValidationResult(issues.length ? 84 : 92, issues);
  },
  async publish(content, validation) {
    return createDraftPublishResult(content, validation.score, validation.canPublish);
  },
};

import type { ContentInput, ValidationIssue } from "../types/content";
import type { PlatformAdapter } from "../types/platform";
import {
  buildAdaptedContent,
  createDraftPublishResult,
  createSummary,
  createValidationResult,
  extractKeyPoints,
  extractTopic,
  uniqueTags,
} from "./adapterUtils";
import { platformProfiles } from "./profiles";

export const weiboAdapter: PlatformAdapter = {
  id: "weibo",
  name: platformProfiles.weibo.name,
  profile: platformProfiles.weibo,
  adapt(input: ContentInput) {
    const topic = extractTopic(input);
    const keyPoints = extractKeyPoints(input, 2);
    const tags = uniqueTags(input.tags, [topic.slice(0, 8), "热点讨论", "经验分享"]);
    const body = [
      `${topic} 最值得讨论的不是结论本身，而是它背后的方法能不能迁移。`,
      "",
      `一句话总结：${keyPoints[0] ?? createSummary(input.body, 80)}`,
      keyPoints[1] ? `再补一句：${keyPoints[1]}` : "",
      "",
      tags.map((tag) => `#${tag}#`).join(" "),
      `你觉得 ${topic} 最值得借鉴的是哪一点？`,
    ].join("\n");

    return buildAdaptedContent(
      "weibo",
      `${topic} 的一个关键判断`.slice(0, 38),
      body,
      input,
      {
        summary: "微博版本已压缩为短观点、话题和评论互动。",
        tags,
        strategyNotes: [
          "微博版本强调短内容传播，保留一个明确观点和一个互动问题。",
          "标签被转换成话题形式，方便进入公开讨论流。",
        ],
      },
    );
  },
  validate(content) {
    const issues: ValidationIssue[] = [];
    if (content.body.length > 500) {
      issues.push({
        level: "warning",
        message: "微博正文偏长。",
        suggestion: "建议压缩到 500 字以内，突出一个传播点。",
      });
    }
    if (content.tags.length < 2) {
      issues.push({
        level: "warning",
        message: "话题标签偏少。",
        suggestion: "建议至少保留 2 个话题，方便被搜索和转发。",
      });
    }
    return createValidationResult(issues.length ? 82 : 91, issues);
  },
  async publish(content, validation) {
    return createDraftPublishResult(content, validation.score, validation.canPublish);
  },
};

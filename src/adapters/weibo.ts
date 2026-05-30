import type { ContentInput, ValidationIssue } from "../types/content";
import type { PlatformAdapter } from "../types/platform";
import {
  buildAdaptedContent,
  createDraftPublishResult,
  createSummary,
  createValidationResult,
  uniqueTags,
} from "./adapterUtils";
import { platformProfiles } from "./profiles";

export const weiboAdapter: PlatformAdapter = {
  id: "weibo",
  name: platformProfiles.weibo.name,
  profile: platformProfiles.weibo,
  adapt(input: ContentInput) {
    const tags = uniqueTags(input.tags, ["AI工具", "学习效率", "经验分享"]);
    const body = [
      `${createSummary(input.body, 110)}`,
      "",
      "一句话总结：工具只是放大器，真正重要的是把它用进学习流程。",
      "",
      tags.map((tag) => `#${tag}#`).join(" "),
      "你会把 AI 用在预习、复习还是自测？",
    ].join("\n");

    return buildAdaptedContent(
      "weibo",
      input.title || "微博短内容标题",
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

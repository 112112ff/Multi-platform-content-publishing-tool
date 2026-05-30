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

export const bilibiliAdapter: PlatformAdapter = {
  id: "bilibili",
  name: platformProfiles.bilibili.name,
  profile: platformProfiles.bilibili,
  adapt(input: ContentInput) {
    const title = input.title ? `【经验分享】${input.title}` : "B站视频标题";
    const body = [
      createSummary(input.body, 120),
      "",
      "本期看点：",
      "1. 先快速讲清楚问题背景",
      "2. 再拆解可复用的方法",
      "3. 最后给出适合收藏的实践清单",
      "",
      "觉得有帮助的话，欢迎三连、收藏，也可以在评论区补充你的经验。",
    ].join("\n");

    return buildAdaptedContent("bilibili", title, body, input, {
      summary: "视频简介已转换为看点列表和互动引导。",
      tags: uniqueTags(input.tags, ["学习", "经验分享", "效率"]),
      strategyNotes: [
        "B站版本加入了视频看点、三连引导和评论互动。",
        "内容被压缩成简介结构，适合放在视频详情页。",
      ],
    });
  },
  validate(_content, input) {
    const issues: ValidationIssue[] = [];
    if (!input.videoUrl) {
      issues.push({
        level: "error",
        message: "缺少视频链接。",
        suggestion: "B站发布必须提供视频内容或视频链接。",
      });
    }
    return createValidationResult(issues.length ? 62 : 88, issues);
  },
  async publish(content, validation) {
    return createDraftPublishResult(content, validation.score, validation.canPublish);
  },
};

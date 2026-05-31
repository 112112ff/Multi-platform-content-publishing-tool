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

export const bilibiliAdapter: PlatformAdapter = {
  id: "bilibili",
  name: platformProfiles.bilibili.name,
  profile: platformProfiles.bilibili,
  adapt(input: ContentInput) {
    const topic = extractTopic(input);
    const keyPoints = extractKeyPoints(input, 4);
    const title = `【深度拆解】${topic}`.slice(0, 48);
    const body = [
      `本期视频围绕「${topic}」展开，适合做成一个有章节、有案例、有总结的内容。`,
      "",
      "本期看点：",
      ...keyPoints.map((point, index) => `${index + 1}. ${point}`),
      "",
      "章节建议：",
      "00:00 先讲结论和为什么值得看",
      "01:10 拆背景：这个话题为什么现在重要",
      "03:20 拆方法：哪些经验可以迁移",
      "06:00 做总结：给观众一张可收藏清单",
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

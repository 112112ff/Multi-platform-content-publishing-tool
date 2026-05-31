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

export const douyinAdapter: PlatformAdapter = {
  id: "douyin",
  name: platformProfiles.douyin.name,
  profile: platformProfiles.douyin,
  adapt(input: ContentInput) {
    const topic = extractTopic(input);
    const keyPoints = extractKeyPoints(input, 3);
    const tags = uniqueTags(input.tags, [topic.slice(0, 8), "短视频脚本", "干货"]);
    const body = [
      `前三秒钩子：很多人聊 ${topic}，但真正能用上的其实就这 3 点。`,
      "",
      "口播脚本：",
      `1. 先抛问题：为什么 ${topic} 值得现在拿出来讲？`,
      ...keyPoints.map((point, index) => `${index + 2}. 给方法 ${index + 1}：${point}`),
      `最后总结：别只记住概念，要把 ${topic} 拆成自己今天能做的一步。`,
      "",
      "镜头提示：开场用大字问题，中段用 3 张流程卡片，结尾放可截图清单。",
      "结尾引导：收藏这条，下次复习前直接照着做。",
    ].join("\n");

    return buildAdaptedContent(
      "douyin",
      `${topic}，别只看热闹`.slice(0, 30),
      body,
      input,
      {
        summary: "抖音版本已转换为短视频钩子、口播脚本和镜头提示。",
        tags,
        strategyNotes: [
          "抖音版本补充了前三秒钩子，适合短视频开场抓注意力。",
          "正文被改成口播脚本和镜头提示，比单纯简介更适合视频发布。",
        ],
      },
    );
  },
  validate(_content, input) {
    const issues: ValidationIssue[] = [];
    if (!input.videoUrl) {
      issues.push({
        level: "warning",
        message: "缺少视频链接。",
        suggestion: "抖音发布前可先保存草稿，正式发布建议绑定视频素材。",
      });
    }
    if (input.tags.length < 2) {
      issues.push({
        level: "info",
        message: "垂直标签不足。",
        suggestion: "建议补充学习、效率、AI 等垂直标签。",
      });
    }
    return createValidationResult(issues.length ? 78 : 89, issues);
  },
  async publish(content, validation) {
    return createDraftPublishResult(content, validation.score, validation.canPublish);
  },
};

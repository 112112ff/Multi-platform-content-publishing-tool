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

export const douyinAdapter: PlatformAdapter = {
  id: "douyin",
  name: platformProfiles.douyin.name,
  profile: platformProfiles.douyin,
  adapt(input: ContentInput) {
    const tags = uniqueTags(input.tags, ["学习方法", "AI效率", "大学生"]);
    const body = [
      "前三秒钩子：你是不是也把 AI 用成了搜索框？其实这样很浪费。",
      "",
      "口播脚本：",
      `1. 先抛问题：${input.title || "AI 学习效率到底怎么提升？"}`,
      `2. 给方法：${createSummary(input.body, 90)}`,
      "3. 做总结：把 AI 放到预习、复盘、自测里，而不是直接替你思考。",
      "",
      "镜头提示：开场用问题字幕，中段放流程卡片，结尾放三步清单。",
      "结尾引导：收藏这条，下次复习前直接照着做。",
    ].join("\n");

    return buildAdaptedContent(
      "douyin",
      input.title ? `${input.title}，别再只会复制粘贴` : "抖音短视频脚本",
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
        suggestion: "抖音模拟发布可保存草稿，正式发布建议绑定视频素材。",
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

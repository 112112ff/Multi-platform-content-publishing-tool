import type { ContentInput, ValidationIssue } from "../types/content";
import type { CustomPlatformConfig, PlatformAdapter } from "../types/platform";
import {
  buildAdaptedContent,
  createDraftPublishResult,
  createSummary,
  createValidationResult,
  splitParagraphs,
  uniqueTags,
} from "./adapterUtils";

export const createCustomPlatformAdapter = (
  config: CustomPlatformConfig,
): PlatformAdapter => ({
  id: config.id,
  name: config.name,
  profile: {
    id: config.id,
    name: config.name,
    positioning: config.positioning,
    contentStrategy: config.contentStrategy,
    tone: config.tone,
    publishRisks: [
      "自定义平台规则需要人工复核",
      config.requiredAsset === "cover"
        ? "缺少封面图会影响发布质量"
        : config.requiredAsset === "video"
          ? "缺少视频素材会影响发布质量"
          : "需确认平台最新规范",
    ],
  },
  adapt(input: ContentInput) {
    const paragraphs = splitParagraphs(input.body);
    const tags = uniqueTags(input.tags, config.tagHints);
    const body = [
      `【${config.tone}】${createSummary(input.body, 110)}`,
      "",
      "内容结构：",
      paragraphs.slice(0, 3).join("\n\n") ||
        "输入正文后，这里会生成适合该自定义平台的内容结构。",
      "",
      `发布策略：${config.contentStrategy}`,
      tags.map((tag) => `#${tag}`).join(" "),
    ].join("\n");

    return buildAdaptedContent(
      config.id,
      input.title || `${config.name} 发布标题`,
      body,
      input,
      {
        summary: createSummary(body, 90),
        tags,
        strategyNotes: [
          `该平台来自扩展配置中心，定位为：${config.positioning}`,
          `系统按“${config.tone}”语气和“${config.contentStrategy}”策略生成内容。`,
        ],
      },
    );
  },
  validate(content, input) {
    const issues: ValidationIssue[] = [];

    if (content.title.length > config.maxTitleLength) {
      issues.push({
        level: "warning",
        message: `${config.name} 标题偏长。`,
        suggestion: `建议控制在 ${config.maxTitleLength} 字以内。`,
      });
    }

    if (config.requiredAsset === "cover" && !input.coverUrl) {
      issues.push({
        level: "warning",
        message: `${config.name} 建议配置封面图。`,
        suggestion: "补充封面图后更适合图文平台发布。",
      });
    }

    if (config.requiredAsset === "video" && !input.videoUrl) {
      issues.push({
        level: "warning",
        message: `${config.name} 建议配置视频素材。`,
        suggestion: "补充视频链接后可提升发布完整度。",
      });
    }

    return createValidationResult(issues.length ? 82 : 90, issues);
  },
  async publish(content, validation) {
    return createDraftPublishResult(content, validation.score, validation.canPublish);
  },
});

import type {
  AdaptedContent,
  ContentInput,
  PublishResult,
  ValidationIssue,
  ValidationResult,
} from "../types/content";
import type { PlatformId } from "../types/platform";

export const splitParagraphs = (body: string) =>
  body
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export const createSummary = (body: string, maxLength = 90) => {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "输入正文后会生成平台摘要。";
  }
  return compact.length > maxLength
    ? `${compact.slice(0, maxLength)}...`
    : compact;
};

export const uniqueTags = (tags: string[], extras: string[] = []) =>
  Array.from(new Set([...tags, ...extras].map((tag) => tag.trim()).filter(Boolean)));

export const createValidationResult = (
  score: number,
  issues: ValidationIssue[],
): ValidationResult => ({
  score,
  canPublish: !issues.some((issue) => issue.level === "error"),
  issues,
});

export const createDraftPublishResult = (
  content: AdaptedContent,
  score: number,
  canPublish = true,
): PublishResult => ({
  id: `${content.platformId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  platformId: content.platformId,
  status: canPublish ? (score >= 88 ? "success" : "draft") : "failed",
  url: canPublish
    ? `https://contentbridge.local/mock/${content.platformId}/${Date.now()}`
    : undefined,
  message: canPublish
    ? score >= 88
      ? "模拟发布成功，已生成演示链接。"
      : "内容已保存为模拟草稿，建议根据体检结果继续优化。"
    : "发布校验未通过，已拦截本平台模拟发布。",
  createdAt: new Date().toISOString(),
  score,
});

export const buildAdaptedContent = (
  platformId: PlatformId,
  title: string,
  body: string,
  input: ContentInput,
  extras: {
    summary?: string;
    tags?: string[];
    strategyNotes: string[];
  },
): AdaptedContent => ({
  platformId,
  title,
  body,
  summary: extras.summary ?? createSummary(body),
  tags: extras.tags ?? input.tags,
  strategyNotes: extras.strategyNotes,
});

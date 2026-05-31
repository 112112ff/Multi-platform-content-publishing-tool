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

export const extractTopic = (input: ContentInput) =>
  (input.title || splitParagraphs(input.body)[0] || "内容主题")
    .replace(/^如何看待/, "")
    .replace(/^一篇讲透[:：]?/, "")
    .replace(/^3 个马上能用的方法[:：]?/, "")
    .trim();

export const extractKeyPoints = (input: ContentInput, limit = 4) => {
  const candidates = splitParagraphs(input.body)
    .flatMap((paragraph) => paragraph.split(/[。！？；;]/))
    .map((line) =>
      line
        .replace(/^[-\d\s.、]+/, "")
        .replace(/^第[一二三四五六七八九十]步，?/, "")
        .trim(),
    )
    .filter((line) => line.length >= 8);

  return (candidates.length ? candidates : [input.title || "先明确核心观点，再按平台重写表达"])
    .slice(0, limit);
};

export const numberedList = (items: string[]) =>
  items.map((item, index) => `${index + 1}. ${item}`).join("\n");

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
      ? "本地发布检查通过，已生成演示链接。"
      : "内容已保存为本地草稿，建议根据体检结果继续优化。"
    : "发布校验未通过，已拦截本平台本地发布。",
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

import type {
  AdaptedContent,
  ContentInput,
  PublishResult,
  ValidationResult,
} from "../types/content";
import type { PlatformAdapter, PlatformProfile } from "../types/platform";

export function createStubAdapter(profile: PlatformProfile): PlatformAdapter {
  return {
    id: profile.id,
    name: profile.name,
    profile,
    adapt(input: ContentInput): AdaptedContent {
      const fallbackTitle = `${profile.name}内容预览`;
      const fallbackBody = "输入原始内容后，这里会生成平台适配版本。";

      return {
        platformId: profile.id,
        title: input.title || fallbackTitle,
        body: input.body || fallbackBody,
        summary: (input.body || fallbackBody).slice(0, 80),
        tags: input.tags,
        strategyNotes: [
          `${profile.name}版本将围绕“${profile.contentStrategy}”进行适配。`,
        ],
      };
    },
    validate(): ValidationResult {
      return {
        score: 70,
        canPublish: true,
        issues: [
          {
            level: "info",
            message: "当前为占位校验结果。",
            suggestion: "后续 PR 将接入平台专属规则。",
          },
        ],
      };
    },
    async publish(content: AdaptedContent): Promise<PublishResult> {
      return {
        id: `${content.platformId}-${Date.now()}`,
        platformId: content.platformId,
        status: "draft",
        message: "当前为占位发布结果。",
        createdAt: new Date().toISOString(),
        score: 70,
      };
    },
  };
}

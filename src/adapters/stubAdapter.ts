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
      return {
        platformId: profile.id,
        title: input.title,
        body: input.body,
        summary: input.body.slice(0, 80),
        tags: input.tags,
        strategyNotes: [
          `${profile.name}适配器将在后续 PR 中接入具体改写规则。`,
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

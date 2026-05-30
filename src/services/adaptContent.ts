import { platformAdapters } from "../adapters/registry";
import type {
  AdaptedContent,
  ContentInput,
  ValidationResult,
} from "../types/content";
import type { PlatformAdapter } from "../types/platform";

export interface PlatformPreview {
  adapter: PlatformAdapter;
  platformName: string;
  positioning: string;
  contentStrategy: string;
  tone: string;
  adapted: AdaptedContent;
  validation: ValidationResult;
}

export function adaptContentForSelectedPlatforms(
  input: ContentInput,
): PlatformPreview[] {
  return platformAdapters
    .filter((adapter) => input.selectedPlatformIds.includes(adapter.id))
    .map((adapter) => {
      const adapted = adapter.adapt(input);
      return {
        adapter,
        platformName: adapter.name,
        positioning: adapter.profile.positioning,
        contentStrategy: adapter.profile.contentStrategy,
        tone: adapter.profile.tone,
        adapted,
        validation: adapter.validate(adapted, input),
      };
    });
}

import { platformAdapters } from "../adapters/registry";
import type { AdaptedContent, ContentInput } from "../types/content";

export interface PlatformPreview {
  platformName: string;
  positioning: string;
  contentStrategy: string;
  tone: string;
  adapted: AdaptedContent;
}

export function adaptContentForSelectedPlatforms(
  input: ContentInput,
): PlatformPreview[] {
  return platformAdapters
    .filter((adapter) => input.selectedPlatformIds.includes(adapter.id))
    .map((adapter) => ({
      platformName: adapter.name,
      positioning: adapter.profile.positioning,
      contentStrategy: adapter.profile.contentStrategy,
      tone: adapter.profile.tone,
      adapted: adapter.adapt(input),
    }));
}

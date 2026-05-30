import type {
  AdaptedContent,
  ContentInput,
  PublishResult,
  ValidationResult,
} from "./content";

export type PlatformId = string;

export interface PlatformProfile {
  id: PlatformId;
  name: string;
  positioning: string;
  contentStrategy: string;
  tone: string;
  publishRisks: string[];
}

export interface CustomPlatformConfig {
  id: PlatformId;
  name: string;
  positioning: string;
  contentStrategy: string;
  tone: string;
  requiredAsset: "none" | "cover" | "video";
  maxTitleLength: number;
  tagHints: string[];
}

export interface PlatformAdapter {
  id: PlatformId;
  name: string;
  profile: PlatformProfile;
  adapt(input: ContentInput): AdaptedContent;
  validate(content: AdaptedContent, input: ContentInput): ValidationResult;
  publish(
    content: AdaptedContent,
    validation: ValidationResult,
  ): Promise<PublishResult>;
}

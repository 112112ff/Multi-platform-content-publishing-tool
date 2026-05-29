export interface ContentInput {
  title: string;
  body: string;
  tags: string[];
  coverUrl?: string;
  videoUrl?: string;
  selectedPlatformIds: string[];
}

export interface AdaptedContent {
  platformId: string;
  title: string;
  body: string;
  summary?: string;
  tags: string[];
  strategyNotes: string[];
}

export interface ValidationIssue {
  level: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  score: number;
  canPublish: boolean;
  issues: ValidationIssue[];
}

export interface PublishResult {
  id: string;
  platformId: string;
  status: "success" | "failed" | "draft";
  url?: string;
  message: string;
  createdAt: string;
  score: number;
}

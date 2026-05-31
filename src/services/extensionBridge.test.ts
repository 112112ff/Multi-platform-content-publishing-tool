import { describe, expect, it } from "vitest";
import type { PublishJob } from "../integrations/matrixOperationEngine";
import type { PlatformPreview } from "./adaptContent";
import { buildExtensionBridgeJob } from "./extensionBridge";

const job: PublishJob = {
  id: "job-zhihu-1",
  accountId: "zhihu-expert-answer",
  platformId: "zhihu",
  authMode: "official-oauth",
  title: "AI 学习效率",
  assetRequirement: "text",
  scheduledAt: "2026-05-30T10:00:00.000Z",
  status: "needs-confirmation",
  executionRoute: "official-api",
};

const preview = {
  adapter: {} as PlatformPreview["adapter"],
  platformName: "知乎",
  positioning: "观点讨论",
  contentStrategy: "问题意识、结论前置",
  tone: "理性、专业",
  adapted: {
    platformId: "zhihu",
    title: "AI 学习效率，真正有效的方法是什么？",
    body: "我的结论是：工具本身不是关键。",
    summary: "知乎摘要",
    tags: ["AI工具"],
    strategyNotes: ["问题式表达"],
  },
  validation: {
    score: 90,
    canPublish: true,
    issues: [],
  },
} as PlatformPreview;

describe("extension bridge", () => {
  it("builds jobs that a browser extension can receive", () => {
    const bridgeJob = buildExtensionBridgeJob({
      job,
      preview,
      accountName: "知乎专业回答号",
      platformName: "知乎",
      createdAt: "2026-05-30T09:00:00.000Z",
    });

    expect(bridgeJob).toMatchObject({
      source: "ContentBridge",
      mode: "real-webhook-delivery",
      bridgeTarget: "browser-extension-publisher",
      platformId: "zhihu",
      accountId: "zhihu-expert-answer",
      title: "AI 学习效率，真正有效的方法是什么？",
    });
  });
});

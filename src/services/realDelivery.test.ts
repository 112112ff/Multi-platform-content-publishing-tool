import { describe, expect, it, vi } from "vitest";
import type { PublishJob } from "../integrations/matrixOperationEngine";
import type { PlatformPreview } from "./adaptContent";
import { buildRealDeliveryPayload, deliverPreviewToReceiver } from "./realDelivery";

const job: PublishJob = {
  id: "job-xhs-1",
  accountId: "xhs-study-note",
  platformId: "xiaohongshu",
  authMode: "browser-session",
  title: "AI 学习效率",
  assetRequirement: "cover",
  scheduledAt: "2026-05-30T10:00:00.000Z",
  status: "needs-confirmation",
  executionRoute: "browser-automation",
};

const preview = {
  adapter: {} as PlatformPreview["adapter"],
  platformName: "小红书",
  positioning: "生活方式种草",
  contentStrategy: "短句表达、场景化描述、话题标签",
  tone: "口语化、轻快",
  adapted: {
    platformId: "xiaohongshu",
    title: "AI 学习效率｜亲测有用",
    body: "这是一段小红书正文。",
    summary: "小红书摘要",
    tags: ["AI工具", "学习效率"],
    strategyNotes: ["短句表达"],
  },
  validation: {
    score: 92,
    canPublish: true,
    issues: [],
  },
} as PlatformPreview;

describe("real delivery service", () => {
  it("builds a verifiable webhook payload", () => {
    const payload = buildRealDeliveryPayload({
      job,
      preview,
      accountName: "小红书学习种草号",
      platformName: "小红书",
      createdAt: "2026-05-30T09:00:00.000Z",
    });

    expect(payload).toMatchObject({
      source: "ContentBridge",
      mode: "real-webhook-delivery",
      platformId: "xiaohongshu",
      accountId: "xhs-study-note",
      title: "AI 学习效率｜亲测有用",
      score: 92,
    });
  });

  it("sends a real POST request through the provided fetcher", async () => {
    const fetcher = vi.fn(async () => new Response("ok", { status: 200 }));

    const result = await deliverPreviewToReceiver({
      receiverUrl: "https://example.test/webhook",
      job,
      preview,
      accountName: "小红书学习种草号",
      platformName: "小红书",
      createdAt: "2026-05-30T09:00:00.000Z",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.test/webhook",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.status).toBe("success");
  });

  it("blocks delivery when validation fails", async () => {
    const fetcher = vi.fn();
    const result = await deliverPreviewToReceiver({
      receiverUrl: "https://example.test/webhook",
      job,
      preview: {
        ...preview,
        validation: { score: 60, canPublish: false, issues: [] },
      },
      accountName: "小红书学习种草号",
      platformName: "小红书",
      createdAt: "2026-05-30T09:00:00.000Z",
      fetcher,
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.status).toBe("blocked");
  });
});

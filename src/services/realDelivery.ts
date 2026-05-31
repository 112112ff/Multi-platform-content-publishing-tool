import type { PublishJob } from "../integrations/matrixOperationEngine";
import type { PlatformPreview } from "./adaptContent";
import type { DeliveryResult } from "../types/delivery";

type FetchLike = typeof fetch;

interface DeliverPreviewOptions {
  receiverUrl: string;
  job: PublishJob;
  preview: PlatformPreview;
  accountName: string;
  platformName: string;
  createdAt: string;
  fetcher?: FetchLike;
}

export const buildRealDeliveryPayload = ({
  job,
  preview,
  accountName,
  platformName,
  createdAt,
}: Omit<DeliverPreviewOptions, "receiverUrl" | "fetcher">) => ({
  source: "ContentBridge",
  mode: "real-webhook-delivery",
  platformId: job.platformId,
  platformName,
  accountId: job.accountId,
  accountName,
  executionRoute: job.executionRoute,
  authMode: job.authMode,
  title: preview.adapted.title,
  body: preview.adapted.body,
  summary: preview.adapted.summary,
  tags: preview.adapted.tags,
  score: preview.validation.score,
  scheduledAt: job.scheduledAt,
  createdAt,
});

export async function deliverPreviewToReceiver({
  receiverUrl,
  job,
  preview,
  accountName,
  platformName,
  createdAt,
  fetcher = fetch,
}: DeliverPreviewOptions): Promise<DeliveryResult> {
  if (!preview.validation.canPublish) {
    return {
      id: `${job.id}-${Date.now()}`,
      platformId: job.platformId,
      accountName,
      status: "blocked",
      executionRoute: job.executionRoute,
      message: "发布体检未通过，已阻止真实投递。",
      createdAt,
      receiverUrl,
    };
  }

  try {
    const response = await fetcher(receiverUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildRealDeliveryPayload({
          job,
          preview,
          accountName,
          platformName,
          createdAt,
        }),
      ),
    });

    return {
      id: `${job.id}-${Date.now()}`,
      platformId: job.platformId,
      accountName,
      status: response.ok ? "success" : "failed",
      executionRoute: job.executionRoute,
      message: response.ok
        ? `已真实 POST 到接收端，HTTP ${response.status}。`
        : `接收端返回 HTTP ${response.status}，请检查服务配置。`,
      createdAt,
      receiverUrl,
    };
  } catch (error) {
    return {
      id: `${job.id}-${Date.now()}`,
      platformId: job.platformId,
      accountName,
      status: "failed",
      executionRoute: job.executionRoute,
      message:
        error instanceof Error
          ? `真实投递失败：${error.message}`
          : "真实投递失败，请检查网络、CORS 或接收端。",
      createdAt,
      receiverUrl,
    };
  }
}

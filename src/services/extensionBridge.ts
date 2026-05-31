import type { PublishJob } from "../integrations/matrixOperationEngine";
import type { DeliveryResult } from "../types/delivery";
import type { PlatformPreview } from "./adaptContent";
import { buildRealDeliveryPayload } from "./realDelivery";

interface ExtensionBridgeJobOptions {
  job: PublishJob;
  preview: PlatformPreview;
  accountName: string;
  platformName: string;
  createdAt: string;
}

interface SendToExtensionBridgeOptions {
  jobs: ExtensionBridgeJobOptions[];
  timeoutMs?: number;
}

interface ExtensionAck {
  ok: boolean;
  results?: Array<{ platformId: string; ok: boolean; url?: string }>;
  error?: string;
}

export const buildExtensionBridgeJob = (options: ExtensionBridgeJobOptions) => ({
  ...buildRealDeliveryPayload(options),
  bridgeTarget: "browser-extension-publisher",
});

const waitForMessage = (type: string, timeoutMs: number) =>
  new Promise<ExtensionAck>((resolve) => {
    if (typeof window === "undefined") {
      resolve({ ok: false, error: "当前环境没有浏览器窗口，无法连接扩展。" });
      return;
    }

    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({ ok: false, error: "没有检测到 ContentBridge 浏览器扩展。" });
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.type !== type) {
        return;
      }

      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve({
        ok: Boolean(event.data.ok),
        results: event.data.results,
        error: event.data.error,
      });
    }

    window.addEventListener("message", onMessage);
  });

export async function sendJobsToExtensionBridge({
  jobs,
  timeoutMs = 1200,
}: SendToExtensionBridgeOptions): Promise<DeliveryResult[]> {
  const createdAt = new Date().toISOString();
  const validJobs = jobs.filter((item) => item.preview.validation.canPublish);
  const blockedResults: DeliveryResult[] = jobs
    .filter((item) => !item.preview.validation.canPublish)
    .map(({ job, accountName }) => ({
      id: `${job.id}-${Date.now()}`,
      platformId: job.platformId,
      accountName,
      status: "blocked",
      executionRoute: "browser-extension",
      message: "发布体检未通过，未发送给浏览器扩展。",
      createdAt,
      receiverUrl: "ContentBridge Extension",
    }));

  if (!validJobs.length) {
    return blockedResults;
  }

  const pingPromise = waitForMessage("CONTENTBRIDGE_EXTENSION_PONG", timeoutMs);
  window.postMessage({ type: "CONTENTBRIDGE_EXTENSION_PING" }, window.location.origin);
  const ping = await pingPromise;

  if (!ping.ok) {
    return [
      ...blockedResults,
      ...validJobs.map(({ job, accountName }) => ({
        id: `${job.id}-${Date.now()}`,
        platformId: job.platformId,
        accountName,
        status: "failed" as const,
        executionRoute: "browser-extension",
        message: ping.error ?? "没有检测到 ContentBridge 浏览器扩展。",
        createdAt,
        receiverUrl: "ContentBridge Extension",
      })),
    ];
  }

  const ackPromise = waitForMessage("CONTENTBRIDGE_PUBLISH_ACK", timeoutMs + 2000);
  window.postMessage(
    {
      type: "CONTENTBRIDGE_PUBLISH_JOBS",
      jobs: validJobs.map(buildExtensionBridgeJob),
    },
    window.location.origin,
  );
  const ack = await ackPromise;

  return [
    ...blockedResults,
    ...validJobs.map(({ job, accountName }) => {
      const platformAck = ack.results?.find((item) => item.platformId === job.platformId);
      const ok = Boolean(ack.ok && platformAck?.ok);

      return {
        id: `${job.id}-${Date.now()}`,
        platformId: job.platformId,
        accountName,
        status: ok ? "success" as const : "failed" as const,
        executionRoute: "browser-extension",
        message: ok
          ? "已发送到浏览器扩展，扩展会打开平台创作页并尝试填充草稿。"
          : ack.error ?? "浏览器扩展未确认发布任务。",
        createdAt,
        receiverUrl: platformAck?.url ?? "ContentBridge Extension",
      };
    }),
  ];
}

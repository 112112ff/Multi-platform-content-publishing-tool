import { describe, expect, it } from "vitest";
import type { ContentInput } from "../types/content";
import {
  buildAgentOperationPlan,
  buildHotspotCrawlPlan,
  demoAccountChannels,
  integrationBlueprints,
  selectAccountChannels,
} from "./matrixOperationEngine";

const content: ContentInput = {
  title: "AI 学习效率：3 个马上能用的方法",
  body: "面向大学生的 AI 工具学习方法，希望能改成短视频口播和小红书真实体验版本。",
  tags: ["AI工具", "学习效率", "短视频"],
  selectedPlatformIds: ["xiaohongshu", "douyin", "bilibili"],
};

describe("matrix operation engine", () => {
  it("keeps the three backend-oriented method blueprints", () => {
    expect(integrationBlueprints.map((blueprint) => blueprint.id)).toEqual([
      "account-channel",
      "hotspot-crawler",
      "upload-runner",
    ]);
    expect(integrationBlueprints.every((blueprint) => blueprint.appliedAs)).toBe(true);
  });

  it("matches creator content to account channels instead of raw platforms only", () => {
    const accounts = selectAccountChannels(content);

    expect(accounts.map((account) => account.id)).toEqual([
      "xhs-study-note",
      "douyin-hook-video",
      "bili-tutorial",
    ]);
  });

  it("builds limited hotspot tasks with platform layering", () => {
    const accounts = demoAccountChannels.slice(0, 2);
    const tasks = buildHotspotCrawlPlan(content, accounts);

    expect(tasks).toHaveLength(4);
    expect(tasks.every((task) => task.maxItems <= 50)).toBe(true);
    expect(tasks.map((task) => task.crawlerType)).toContain("comment-mining");
  });

  it("creates publish jobs that require confirmation before upload", () => {
    const plan = buildAgentOperationPlan(content);

    expect(plan.publishJobs).toHaveLength(3);
    expect(plan.publishJobs.every((job) => job.status === "needs-confirmation")).toBe(true);
    expect(plan.publishJobs.map((job) => job.executionRoute)).toEqual([
      "browser-automation",
      "browser-automation",
      "browser-automation",
    ]);
    expect(plan.guardrails.join("")).toContain("不直接发布");
  });

  it("keeps every explicitly selected platform in the publish plan", () => {
    const plan = buildAgentOperationPlan({
      ...content,
      title: "真实体验：学习工具使用心得",
      body: "这是一篇偏小红书真实体验的内容，但用户也要求同步发到知乎。",
      selectedPlatformIds: ["xiaohongshu", "zhihu"],
    });

    expect(plan.publishJobs.map((job) => job.platformId)).toEqual([
      "xiaohongshu",
      "zhihu",
    ]);
  });
});

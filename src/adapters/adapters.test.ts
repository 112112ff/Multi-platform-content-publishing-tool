import { describe, expect, it } from "vitest";
import { createCustomPlatformAdapter } from "./customAdapter";
import { platformAdapters } from "./registry";
import { sampleContentInput } from "../data/sampleContent";

describe("platform adapters", () => {
  it("registers six publish targets", () => {
    expect(platformAdapters.map((adapter) => adapter.id)).toEqual([
      "wechat",
      "zhihu",
      "bilibili",
      "xiaohongshu",
      "weibo",
      "douyin",
    ]);
  });

  it("generates adapted content and validation for every platform", () => {
    for (const adapter of platformAdapters) {
      const adapted = adapter.adapt(sampleContentInput);
      const validation = adapter.validate(adapted, sampleContentInput);

      expect(adapted.platformId).toBe(adapter.id);
      expect(adapted.title.length).toBeGreaterThan(0);
      expect(adapted.body.length).toBeGreaterThan(0);
      expect(adapted.strategyNotes.length).toBeGreaterThan(0);
      expect(validation.score).toBeGreaterThan(0);
      expect(validation.score).toBeLessThanOrEqual(100);
    }
  });

  it("creates a working adapter from custom platform config", async () => {
    const adapter = createCustomPlatformAdapter({
      id: "custom-kuaishou",
      name: "快手",
      positioning: "短视频社区",
      contentStrategy: "短句开场，突出经验和互动",
      tone: "轻快、直接",
      requiredAsset: "video",
      maxTitleLength: 20,
      tagHints: ["短视频", "经验分享"],
    });

    const adapted = adapter.adapt(sampleContentInput);
    const validation = adapter.validate(adapted, {
      ...sampleContentInput,
      videoUrl: "",
    });
    const result = await adapter.publish(adapted, validation);

    expect(adapted.platformId).toBe("custom-kuaishou");
    expect(adapted.tags).toContain("短视频");
    expect(validation.issues.some((issue) => issue.message.includes("快手"))).toBe(
      true,
    );
    expect(result.platformId).toBe("custom-kuaishou");
  });
});

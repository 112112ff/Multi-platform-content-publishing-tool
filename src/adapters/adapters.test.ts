import { describe, expect, it } from "vitest";
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
});

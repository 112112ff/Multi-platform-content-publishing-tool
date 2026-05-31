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
    const bodies = new Set<string>();

    for (const adapter of platformAdapters) {
      const adapted = adapter.adapt(sampleContentInput);
      const validation = adapter.validate(adapted, sampleContentInput);

      expect(adapted.platformId).toBe(adapter.id);
      expect(adapted.title.length).toBeGreaterThan(0);
      expect(adapted.body.length).toBeGreaterThan(0);
      expect(adapted.strategyNotes.length).toBeGreaterThan(0);
      expect(validation.score).toBeGreaterThan(0);
      expect(validation.score).toBeLessThanOrEqual(100);
      bodies.add(adapted.body);
    }

    expect(bodies.size).toBe(platformAdapters.length);
  });

  it("rewrites the same source into recognizable platform formats", () => {
    const source = {
      ...sampleContentInput,
      title: "字节跳动公司的产品增长方法",
      body: "字节跳动的产品增长依赖高频实验、算法分发和组织效率。\n\n创作者可以借鉴的是先验证需求，再用数据反馈优化内容。\n\n真正重要的是把增长方法拆成可执行动作。",
      tags: ["字节跳动", "产品增长"],
      selectedPlatformIds: platformAdapters.map((adapter) => adapter.id),
    };

    const byPlatform = Object.fromEntries(
      platformAdapters.map((adapter) => [adapter.id, adapter.adapt(source)]),
    );

    expect(byPlatform.wechat.body).toContain("## 一、为什么这个话题值得关注");
    expect(byPlatform.zhihu.body).toContain("### 分析");
    expect(byPlatform.xiaohongshu.body).toContain("最近整理");
    expect(byPlatform.bilibili.body).toContain("章节建议");
    expect(byPlatform.douyin.body).toContain("口播脚本");
    expect(byPlatform.weibo.body).toContain("#字节跳动#");
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

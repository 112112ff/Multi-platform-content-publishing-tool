import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAgentPlanWithMiniMax, buildPlatformPackWithMiniMax } from "./minimaxAgent";

describe("minimaxAgent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses MiniMax proxy response when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          plan: {
            platformId: "xiaohongshu",
            title: "AI 学习效率笔记",
            body: "这是一篇由 MiniMax 生成的小红书草稿。",
            tags: ["AI工具", "学习效率"],
            reply: "MiniMax 建议先发小红书。",
          },
        }),
      })),
    );

    const plan = await buildAgentPlanWithMiniMax("帮我写一篇小红书笔记");

    expect(plan.source).toBe("minimax");
    expect(plan.platform.id).toBe("xiaohongshu");
    expect(plan.content.body).toContain("MiniMax");
  });

  it("falls back to local agent when proxy is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network failed");
      }),
    );

    const plan = await buildAgentPlanWithMiniMax("写一篇知乎回答");

    expect(plan.source).toBe("local");
    expect(plan.platform.id).toBe("zhihu");
  });

  it("uses complete platform pack drafts when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          model: "test-model",
          pack: {
            reply: "multi-platform pack ready",
            primaryPlatformId: "xiaohongshu",
            drafts: [
              {
                platformId: "xiaohongshu",
                title: "RedNote title",
                body: "RedNote body",
                tags: ["tag-a"],
                strategyNotes: ["native note"],
              },
              {
                platformId: "zhihu",
                title: "Zhihu title",
                body: "Zhihu body",
                tags: ["tag-b"],
              },
            ],
          },
        }),
      })),
    );

    const pack = await buildPlatformPackWithMiniMax({
      prompt: "make a content pack",
      brief: {
        topic: "ByteDance growth",
        intent: "explain",
        audience: "creators",
        trendSignals: "AI native apps",
      },
    });

    expect(pack?.source).toBe("minimax");
    expect(pack?.model).toBe("test-model");
    expect(pack?.primaryPlatformId).toBe("xiaohongshu");
    expect(pack?.drafts.xiaohongshu.body).toBe("RedNote body");
    expect(pack?.drafts.zhihu.tags).toEqual(["tag-b"]);
  });

  it("returns null when platform pack generation is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network failed");
      }),
    );

    const pack = await buildPlatformPackWithMiniMax({
      prompt: "make a content pack",
      brief: {
        topic: "ByteDance growth",
        intent: "explain",
        audience: "creators",
        trendSignals: "",
      },
    });

    expect(pack).toBeNull();
  });
});

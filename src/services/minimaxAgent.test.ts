import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAgentPlanWithMiniMax } from "./minimaxAgent";

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
});

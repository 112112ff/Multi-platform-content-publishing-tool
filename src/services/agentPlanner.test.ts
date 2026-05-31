import { describe, expect, it } from "vitest";
import { buildAgentPlan, inferPlatform } from "./agentPlanner";

describe("agentPlanner", () => {
  it("selects a single platform from the user prompt", () => {
    expect(inferPlatform("帮我写一篇小红书学习效率笔记").id).toBe("xiaohongshu");
    expect(inferPlatform("做一个抖音口播脚本").id).toBe("douyin");
    expect(inferPlatform("这篇内容适合公众号长文").id).toBe("wechat");
  });

  it("builds one publish target instead of expanding to all platforms", () => {
    const plan = buildAgentPlan("帮我写一篇知乎回答，主题是 AI 工具提升学习效率");

    expect(plan.platform.id).toBe("zhihu");
    expect(plan.content.selectedPlatformIds).toEqual(["zhihu"]);
    expect(plan.content.title).toContain("AI 工具提升学习效率");
    expect(plan.reply).toContain("知乎");
  });
});

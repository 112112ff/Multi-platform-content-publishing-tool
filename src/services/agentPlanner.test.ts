import { describe, expect, it } from "vitest";
import { buildAgentPlan, buildAgentPlanFromRemote, inferPlatform } from "./agentPlanner";

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

  it("treats byte in company context as ByteDance instead of the computer unit", () => {
    const plan = buildAgentPlan("帮我写一篇关于字节的公众号长文章，偏专业分析", undefined, {
      length: "long",
      style: "professional",
      hotness: "trend",
    });

    expect(plan.platform.id).toBe("wechat");
    expect(plan.content.title).toContain("字节跳动");
    expect(plan.content.body).toContain("字节跳动公司");
    expect(plan.content.body).not.toContain("计算机字节单位");
    expect(plan.content.tags).toContain("字节跳动");
  });

  it("merges MiniMax JSON into a safe single-platform plan", () => {
    const plan = buildAgentPlanFromRemote(
      {
        platformId: "douyin",
        title: "3 个提升发布效率的方法",
        body: "第一步，先确定平台。\n\n第二步，改写内容。\n\n第三步，确认发布。",
        tags: ["短视频", "内容创作"],
        reply: "MiniMax 建议先发抖音，因为用户需要口播脚本。",
      },
      "做一个抖音口播脚本",
    );

    expect(plan.source).toBe("minimax");
    expect(plan.platform.id).toBe("douyin");
    expect(plan.content.selectedPlatformIds).toEqual(["douyin"]);
    expect(plan.content.tags).toEqual(["短视频", "内容创作"]);
  });
});

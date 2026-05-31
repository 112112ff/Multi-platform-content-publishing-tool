import { describe, expect, it } from "vitest";
import { parseSourceContentToInput } from "./sourceContent";

describe("sourceContent", () => {
  it("parses a pasted manuscript title, body and tags", () => {
    const parsed = parseSourceContentToInput(
      [
        "# AI 工具如何提升学习效率",
        "",
        "我最近发现，真正有用的 AI 工具不是替你偷懒，而是帮你把学习流程拆清楚。",
        "第一步是整理问题，第二步是生成练习，第三步是复盘错题。",
        "",
        "#AI工具 #学习效率",
      ].join("\n"),
      ["xiaohongshu", "zhihu"],
    );

    expect(parsed.title).toBe("AI 工具如何提升学习效率");
    expect(parsed.body).toContain("真正有用的 AI 工具");
    expect(parsed.body).not.toContain("#AI工具");
    expect(parsed.tags).toEqual(["AI工具", "学习效率"]);
    expect(parsed.selectedPlatformIds).toEqual(["xiaohongshu", "zhihu"]);
  });

  it("keeps paragraph content when there is no explicit title", () => {
    const parsed = parseSourceContentToInput(
      "多平台分发最麻烦的地方，是同一篇内容不能直接复制到所有平台。不同平台的标题、正文节奏和标签都不一样。",
    );

    expect(parsed.title).toContain("多平台分发最麻烦的地方");
    expect(parsed.body).toContain("同一篇内容不能直接复制");
    expect(parsed.tags).toContain("内容改写");
  });
});

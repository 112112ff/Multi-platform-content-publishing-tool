import type { ContentInput } from "../types/content";

export const emptyContentInput: ContentInput = {
  title: "",
  body: "",
  tags: [],
  coverUrl: "",
  videoUrl: "",
  selectedPlatformIds: ["wechat", "zhihu", "bilibili", "xiaohongshu"],
};

export const sampleContentInput: ContentInput = {
  title: "AI 工具如何帮助大学生提升学习效率",
  body: [
    "这学期我尝试把 AI 工具加入学习流程，发现真正有用的不是让它直接替我完成作业，而是把它当成一个随时可用的学习助教。",
    "在预习阶段，我会让 AI 先解释课程大纲和核心概念，快速建立知识地图。上课后，我再把老师讲的重点整理成问题清单，用它帮助我检查遗漏。",
    "复习阶段最有帮助的是让 AI 根据笔记生成自测题。相比单纯反复看笔记，这种方式更容易发现自己到底哪里没理解。",
    "不过 AI 也不是万能的。它可能会编造资料，也可能把概念解释得过于简化，所以关键结论仍然需要回到教材、论文或老师给出的资料中确认。",
    "我的经验是：把 AI 用在拆解任务、生成问题、辅助复盘上，而不是用来逃避思考。这样才能真正提升学习效率。",
  ].join("\n\n"),
  tags: ["AI学习", "大学生", "效率工具", "学习方法"],
  coverUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3",
  videoUrl: "https://www.bilibili.com/video/BV1example",
  selectedPlatformIds: ["wechat", "zhihu", "bilibili", "xiaohongshu"],
};

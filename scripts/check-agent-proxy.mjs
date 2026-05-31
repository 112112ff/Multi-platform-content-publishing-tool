const baseUrl = (process.env.AGENT_PROXY_BASE_URL ?? "http://127.0.0.1:8787").replace(
  /\/+$/,
  "",
);

const expectedPlatforms = [
  "xiaohongshu",
  "zhihu",
  "bilibili",
  "wechat",
  "weibo",
  "douyin",
];

const readJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${url} did not return JSON: ${text.slice(0, 240)}`);
  }

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}: ${text.slice(0, 240)}`);
  }

  return data;
};

const health = await readJson(`${baseUrl}/api/agent-health`);

if (!health.ok) {
  throw new Error(`Agent health check failed: ${JSON.stringify(health)}`);
}

if (!health.configured) {
  throw new Error(
    "Agent proxy is running, but MINIMAX_API_KEY is not configured on this service.",
  );
}

const payload = {
  prompt:
    "请把这篇关于 AI 工具提升学习效率的原文改写成多平台可发布内容，保留核心观点。",
  brief: {
    topic: "AI 工具提升学习效率",
    intent: "把已有经验改成多平台发布包",
    audience: "学生、职场新人和内容创作者",
    trendSignals: "AI 原生应用、效率工具、学习方法",
  },
  previousContent: {
    title: "AI 工具如何提升学习效率",
    body:
      "我最近发现，真正有用的 AI 工具不是替你偷懒，而是帮你把学习流程拆清楚。先整理问题，再生成练习，最后复盘错题。这个方法适合准备考试、写论文和做技能训练的人。",
    tags: ["AI工具", "学习效率", "学习方法"],
    selectedPlatformIds: expectedPlatforms,
  },
  preferences: {
    length: "medium",
    style: "practical",
    hotness: "trend",
  },
  conversation: [],
};

const result = await readJson(`${baseUrl}/api/platform-pack`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

if (!result.ok) {
  throw new Error(`Platform pack request failed: ${result.error ?? JSON.stringify(result)}`);
}

const drafts = Array.isArray(result.pack?.drafts) ? result.pack.drafts : [];
const platformIds = drafts.map((draft) => draft.platformId);
const missingPlatforms = expectedPlatforms.filter(
  (platformId) => !platformIds.includes(platformId),
);

if (missingPlatforms.length) {
  throw new Error(`Platform pack missed platforms: ${missingPlatforms.join(", ")}`);
}

for (const draft of drafts) {
  if (!draft.title?.trim() || !draft.body?.trim()) {
    throw new Error(`Draft for ${draft.platformId} is missing title or body.`);
  }
}

console.log("Agent proxy check passed.");
console.log(`Base URL: ${baseUrl}`);
console.log(`Model: ${result.model ?? health.model ?? "unknown"}`);
console.log(`Platforms: ${platformIds.join(", ")}`);

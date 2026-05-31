import http from "node:http";
import { readFileSync, existsSync } from "node:fs";

const envPath = new URL("../.env", import.meta.url);

if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    process.env[key.trim()] ??= valueParts.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

const port = Number(process.env.MINIMAX_PROXY_PORT ?? 8787);
const model = process.env.MINIMAX_MODEL ?? "MiniMax-M2.7";
const apiUrl = process.env.MINIMAX_API_URL ?? "https://api.minimax.io/v1/chat/completions";
const apiKey = process.env.MINIMAX_API_KEY;

const platforms = [
  "xiaohongshu",
  "zhihu",
  "bilibili",
  "wechat",
  "weibo",
  "douyin",
];

const readBody = (request) =>
  new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

const sendJson = (response, status, payload) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
};

const extractJson = (value) => {
  const trimmed = value.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];

    if (fenced) {
      return JSON.parse(fenced);
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error("MiniMax response is not valid JSON");
  }
};

const buildPrompt = ({ prompt, previousContent }) => `
你是 ContentBridge 的中文发布助理。用户会用自然语言说明想发布的内容，你需要判断最适合先发布的一个平台，并生成该平台的可发布草稿。

只能从这些 platformId 中选择一个：${platforms.join(", ")}

平台选择规则：
- 小红书：笔记、种草、生活方式、清单、收藏。
- 知乎：问答、观点、专业分析、经验判断。
- B站：视频教程、长视频简介、分章讲解。
- 公众号：长文、私域、深度文章、品牌内容。
- 微博：热点、短观点、话题讨论。
- 抖音：短视频、口播、镜头脚本、强钩子。

输出必须是纯 JSON，不要 Markdown，不要解释，字段如下：
{
  "platformId": "xiaohongshu | zhihu | bilibili | wechat | weibo | douyin",
  "title": "平台化标题",
  "body": "平台化正文，使用换行组织段落",
  "tags": ["标签1", "标签2", "标签3"],
  "reply": "用自然语言告诉用户为什么选择这个平台，以及下一步确认账号后一键发布"
}

用户输入：
${prompt}

上一版内容，可为空：
${JSON.stringify(previousContent ?? null)}
`;

const requestMiniMax = async (payload) => {
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY is not configured");
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是一个可靠的内容发布助理，只返回可被 JSON.parse 解析的 JSON。",
        },
        {
          role: "user",
          content: buildPrompt(payload),
        },
      ],
      temperature: 0.7,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`MiniMax API HTTP ${response.status}: ${text.slice(0, 240)}`);
  }

  const data = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("MiniMax response did not include message content");
  }

  const plan = extractJson(content);

  if (!platforms.includes(plan.platformId)) {
    throw new Error("MiniMax returned unsupported platformId");
  }

  return {
    platformId: plan.platformId,
    title: String(plan.title ?? ""),
    body: String(plan.body ?? ""),
    tags: Array.isArray(plan.tags) ? plan.tags.map(String).slice(0, 8) : [],
    reply: String(plan.reply ?? ""),
  };
};

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && request.url === "/api/agent-health") {
    sendJson(response, 200, {
      ok: true,
      provider: "minimax",
      configured: Boolean(apiKey),
      model,
      message: apiKey
        ? "MiniMax proxy is running and API key is configured."
        : "MiniMax proxy is running but MINIMAX_API_KEY is not configured.",
    });
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/agent-plan") {
    sendJson(response, 404, { ok: false, error: "Not found" });
    return;
  }

  try {
    const body = await readBody(request);
    const payload = JSON.parse(body || "{}");
    const prompt = String(payload.prompt ?? "").trim();

    if (!prompt) {
      sendJson(response, 400, { ok: false, error: "prompt is required" });
      return;
    }

    const plan = await requestMiniMax({
      prompt,
      previousContent: payload.previousContent,
    });

    sendJson(response, 200, { ok: true, model, plan });
  } catch (error) {
    sendJson(response, 200, {
      ok: false,
      error: error instanceof Error ? error.message : "MiniMax agent failed",
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MiniMax agent proxy listening on http://127.0.0.1:${port}`);
});

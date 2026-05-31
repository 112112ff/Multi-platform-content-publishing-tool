# MiniMax 发布助理接入说明

本项目已把 MiniMax 接入到左侧发布助理主流程。用户输入一句话或粘贴原文后，前端会调用本地代理服务，代理再请求 MiniMax Chat Completions API，并优先返回六平台发布包。

## 为什么需要本地代理

MiniMax API key 不能写进前端代码，也不能提交到 GitHub。前端页面会被浏览器下载，任何写在页面里的 key 都会暴露。

因此项目采用：

```txt
Browser UI
  -> http://127.0.0.1:8787/api/platform-pack
  -> http://127.0.0.1:8787/api/agent-plan
  -> scripts/minimax-proxy.mjs
  -> https://api.minimaxi.com/v1/chat/completions
  -> MiniMax JSON draft pack / plan
  -> Browser UI
```

如果代理没有启动，或本地没有配置 `MINIMAX_API_KEY`，前端会自动降级到本地离线规则，项目仍然可以演示。

## 本地启动方式

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 在 `.env` 中填写自己的 MiniMax key：

```env
MINIMAX_API_KEY=你的 MiniMax API Key
MINIMAX_MODEL=MiniMax-M2.7
MINIMAX_API_URL=https://api.minimaxi.com/v1/chat/completions
MINIMAX_PROXY_PORT=8787
VITE_AGENT_API_URL=http://127.0.0.1:8787/api/agent-plan
VITE_PLATFORM_PACK_API_URL=http://127.0.0.1:8787/api/platform-pack
```

3. 启动带 Agent 代理的开发环境：

```bash
npm run dev:agent
```

也可以分两个终端启动：

```bash
npm run agent:proxy
npm run dev
```

## 返回格式

MiniMax 被要求只返回 JSON：

```json
{
  "platformId": "xiaohongshu",
  "title": "平台化标题",
  "body": "平台化正文",
  "tags": ["标签1", "标签2"],
  "reply": "为什么选择这个平台，以及下一步做什么"
}
```

`/api/platform-pack` 会优先返回多平台成稿包，前端用它覆盖各平台预览内容：
```json
{
  "reply": "多平台发布包已生成。",
  "primaryPlatformId": "xiaohongshu",
  "drafts": [
    {
      "platformId": "xiaohongshu",
      "title": "可直接发布的标题",
      "body": "可直接发布的正文",
      "tags": ["标签1", "标签2"],
      "strategyNotes": ["平台化原因", "发布前检查点"]
    }
  ]
}
```

前端会校验 `platformId`，并合并成本项目统一的发布计划或多平台预览内容。不支持的平台会回退到本地离线规则。

## 安全要求

- 不要把真实 API key 写进源码。
- 不要提交 `.env`。
- 如果 key 曾经出现在聊天、截图、公开仓库或 PR 描述中，应立即去 MiniMax 控制台作废并重新生成。

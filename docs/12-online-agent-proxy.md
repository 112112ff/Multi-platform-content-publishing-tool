# 线上 AI 代理部署说明

本文档用于把 ContentBridge 的本地 MiniMax 代理部署成线上服务，让评审员下载项目后可以直接调用团队提供的 AI 生成能力。

## 目标链路

```txt
评审员浏览器
  -> ContentBridge 前端
  -> 团队线上代理 /api/platform-pack
  -> MiniMax Chat Completions API
  -> 多平台标题、正文、标签、发布策略
  -> ContentBridge 前端预览页
```

API Key 只放在部署平台的环境变量里。GitHub 仓库只保存代理代码和代理 URL。

## 已内置的代理接口

代理脚本位于：

```txt
scripts/minimax-proxy.mjs
```

提供三个接口：

```txt
GET  /api/agent-health
POST /api/agent-plan
POST /api/platform-pack
```

线上环境会自动读取平台注入的 `PORT`，本地环境默认使用 `8787`。服务会监听 `0.0.0.0`，可以被 Render、Railway 等平台正常转发。

## Render 部署方式

仓库已加入 `render.yaml`，Render 可以按 Blueprint 识别。

1. 打开 Render，选择 `New` -> `Blueprint`。
2. 连接 GitHub 仓库。
3. 选择本项目仓库。
4. Render 会读取 `render.yaml`，自动使用：

```txt
Build Command: npm install
Start Command: npm run agent:proxy
Health Check Path: /api/agent-health
```

5. 在 Render 环境变量里填写：

```env
MINIMAX_API_KEY=你的真实 MiniMax API Key
MINIMAX_MODEL=MiniMax-M2.7
MINIMAX_API_URL=https://api.minimaxi.com/v1/chat/completions
```

6. 部署成功后得到类似地址：

```txt
https://contentbridge-agent-proxy.onrender.com
```

## 验证代理是否可用

先访问健康接口：

```txt
https://你的代理域名/api/agent-health
```

如果返回里有：

```json
{
  "ok": true,
  "configured": true
}
```

说明代理已经拿到了服务器环境变量里的 MiniMax Key。

也可以在本地运行完整检查：

```powershell
$env:AGENT_PROXY_BASE_URL="https://你的代理域名"
npm run agent:check
```

检查脚本会真实请求 `/api/platform-pack`，并确认 6 个平台都返回了可发布的标题和正文。

## 让前端默认使用线上代理

部署成功后，把前端环境变量指向线上代理：

```env
VITE_AGENT_API_URL=https://你的代理域名/api/agent-plan
VITE_PLATFORM_PACK_API_URL=https://你的代理域名/api/platform-pack
VITE_AGENT_HEALTH_URL=https://你的代理域名/api/agent-health
```

如果要让评审员下载后不配置 `.env` 也能直接用 AI，需要在拿到稳定代理域名后，把 `src/services/minimaxAgent.ts` 里的默认接口地址改成线上代理地址。注意，只能写代理 URL，不能写 MiniMax API Key。

## 失败兜底

如果线上代理冷启动、限流或 MiniMax 临时失败，前端会自动降级到离线规则模式。这样项目仍能完成：

```txt
输入内容 -> 识别原文 -> 多平台适配预览 -> 模拟发布 / 官方创作页
```

Demo 视频建议展示两段：

1. 线上代理可用时的 AI 多平台成稿。
2. 代理不可用时的离线规则兜底，证明主链路不会中断。

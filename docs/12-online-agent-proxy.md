# 线上 AI 代理部署说明

本文档用于把 ContentBridge 部署成一个线上可访问的完整服务。部署完成后，同一个域名会同时提供前端页面和 MiniMax 代理接口，让评审员可以直接打开线上 Demo，也可以下载仓库本地运行。

## 目标链路

```txt
评审员浏览器
  -> https://你的服务域名/
  -> 同域名 /api/platform-pack
  -> MiniMax Chat Completions API
  -> 多平台标题、正文、标签、发布策略
  -> ContentBridge 前端预览页
```

API Key 只放在部署平台的环境变量里。GitHub 仓库只保存代理代码和公开服务 URL。

## 已内置的代理接口

服务入口脚本位于：

```txt
scripts/minimax-proxy.mjs
```

它会先托管 `dist/` 里的前端构建产物，再提供三个 API 接口：

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
Build Command: npm install && npm run build
Start Command: npm run start
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
https://contentbridge.onrender.com
```

## 验证代理是否可用

先访问健康接口：

```txt
https://你的服务域名/api/agent-health
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
$env:AGENT_PROXY_BASE_URL="https://你的服务域名"
npm run agent:check
```

检查脚本会真实请求 `/api/platform-pack`，并确认 6 个平台都返回了可发布的标题和正文。

## 前端如何调用线上 API

线上部署时，前端会自动请求同域名下的接口：

```txt
/api/agent-plan
/api/platform-pack
/api/agent-health
```

如果你想让本地开发环境也请求线上服务，可以额外创建 `.env`：

```env
VITE_AGENT_API_URL=https://你的服务域名/api/agent-plan
VITE_PLATFORM_PACK_API_URL=https://你的服务域名/api/platform-pack
VITE_AGENT_HEALTH_URL=https://你的服务域名/api/agent-health
```

默认情况下，`npm run dev` 本地开发会寻找 `http://127.0.0.1:8787` 的本地代理；线上构建会请求当前页面同域名的 `/api/*`。

## 失败兜底

如果线上代理冷启动、限流或 MiniMax 临时失败，前端会自动降级到离线规则模式。这样项目仍能完成：

```txt
输入内容 -> 识别原文 -> 多平台适配预览 -> 模拟发布 / 官方创作页
```

Demo 视频建议展示两段：

1. 线上代理可用时的 AI 多平台成稿。
2. 代理不可用时的离线规则兜底，证明主链路不会中断。

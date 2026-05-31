# 评委运行与提交说明

这份文档用于解释评委从 GitHub 拉取项目后，如何稳定运行 ContentBridge，以及 MiniMax Agent 在评审环境中的使用边界。

## 必须能无密钥运行

比赛要求评委能复现演示效果，但评委不会拥有我们的私有 API key。因此项目必须做到：

- 不提交 `.env`。
- 不把 MiniMax API key 写进前端或 README。
- 没有 key 时仍能运行核心流程。
- MiniMax 不可用时自动降级到本地 Agent。

当前项目满足这个要求。普通运行方式：

```bash
npm install
npm run dev
```

访问：

```txt
http://127.0.0.1:5173/
```

此时页面左侧会显示“本地 Agent 降级”，但用户仍可完成：

```txt
一句话输入 -> 单平台草稿 -> 账号确认 -> 一键发布到平台草稿 / 测试接收端
```

## 启用 MiniMax Agent

如果评委或演示人员希望体验真实 MiniMax Agent，需要本地配置自己的 MiniMax key：

```bash
cp .env.example .env
```

在 `.env` 中填写：

```env
MINIMAX_API_KEY=自己的 MiniMax API Key
MINIMAX_MODEL=MiniMax-M2.7
MINIMAX_API_URL=https://api.minimax.io/v1/chat/completions
MINIMAX_PROXY_PORT=8787
VITE_AGENT_API_URL=http://127.0.0.1:8787/api/agent-plan
```

启动：

```bash
npm run dev:agent
```

启动后页面左侧会显示 MiniMax 状态：

- `MiniMax 已连接`：代理启动且 key 已配置，Agent 会请求 MiniMax。
- `缺少 MiniMax Key`：代理启动但 `.env` 没有 key，会降级。
- `本地 Agent 降级`：代理没启动，会降级。

## Demo 推荐策略

Demo 视频中建议展示两段：

1. 无 key 情况下的稳定主流程，证明评委拉代码后可直接跑通。
2. 配置 key 后的 MiniMax Agent 生成效果，证明 AI 接入真实存在。

这样既满足比赛可复现要求，也能展示创新性。

## 提交前风险提醒

- 真实 API key 不能提交到 GitHub。
- 如果 key 曾经出现在聊天、截图、PR 描述或公开页面，应立即在 MiniMax 控制台作废并重新生成。
- Demo 视频录制时不要展示 `.env` 内容。
- README 中只保留 `.env.example` 和配置步骤。

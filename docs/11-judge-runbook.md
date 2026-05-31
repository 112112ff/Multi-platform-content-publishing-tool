# 评委运行与提交说明

这份文档用于解释评委从 GitHub 拉取项目后，如何稳定运行 ContentBridge，以及 MiniMax 增强生成在评审环境中的使用边界。

## 必须能无密钥运行

比赛要求评委能复现演示效果，但评委不会拥有我们的私有 API key。仓库截止后需要公开，真实 key 不能提交到 GitHub。因此项目必须做到：

- 不提交 `.env`。
- 不把 MiniMax API key 写进前端或 README。
- 没有 key 时仍能运行核心流程。
- MiniMax 不可用时自动降级到本地离线规则。

当前项目满足这个要求。普通运行方式：

```bash
npm install
npm run dev
```

访问：

```txt
http://127.0.0.1:5173/
```

此时页面会显示离线规则可用，用户仍可完成：

```txt
一句话输入 -> 单平台草稿 -> 账号确认 -> 打开官方创作页并复制草稿 / 测试接收端
```

## 启用 MiniMax 增强生成

如果评委或演示人员希望体验真实 MiniMax 生成，需要本地配置自己的 MiniMax key：

```bash
cp .env.example .env
```

在 `.env` 中填写：

```env
MINIMAX_API_KEY=自己的 MiniMax API Key
MINIMAX_MODEL=MiniMax-M2.7
MINIMAX_API_URL=https://api.minimaxi.com/v1/chat/completions
MINIMAX_PROXY_PORT=8787
VITE_AGENT_API_URL=http://127.0.0.1:8787/api/agent-plan
VITE_PLATFORM_PACK_API_URL=http://127.0.0.1:8787/api/platform-pack
```

说明：

- 中国大陆账号建议使用 `https://api.minimaxi.com/v1/chat/completions`。
- 国际账号可改为 `https://api.minimax.io/v1/chat/completions`。
- 如果域名和账号区域不匹配，可能出现 `invalid api key (2049)`。

启动：

```bash
npm run dev:agent
```

启动后页面会显示增强生成状态：

- `发布助理已增强`：代理启动且 key 已配置，会请求 MiniMax。
- `离线规则可用`：代理启动但 `.env` 没有 key，或生成失败后自动降级。
- `离线规则模式`：代理没启动，会使用本地离线规则。

## 为什么不把 API key 放进仓库

不建议把真实 key 放入 GitHub 仓库，原因：

- 仓库最终公开后 key 会被任何人复制调用，产生费用风险。
- 平台可能识别到公开泄露并禁用 key。
- PR、commit 历史很难彻底删除泄露记录。

如果必须让评委体验增强生成，推荐两种安全方式：

1. 在 Demo 视频中展示已配置 key 的演示环境，并在 README 说明本地配置方式。
2. 临时部署一个受限的代理服务，把 key 放在服务器环境变量中，前端只配置代理 URL，不把 key 发到浏览器或仓库。

比赛评审的可复现底线仍然由离线规则保证：评委不配置 key 也能完整跑通主流程。

## Demo 推荐策略

Demo 视频中建议展示两段：

1. 无 key 情况下的稳定主流程，证明评委拉代码后可直接跑通。
2. 配置 key 后的 MiniMax 增强生成效果，证明 AI 接入真实存在。

这样既满足比赛可复现要求，也能展示创新性。

## 提交前风险提醒

- 真实 API key 不能提交到 GitHub。
- 如果 key 曾经出现在聊天、截图、PR 描述或公开页面，应立即在 MiniMax 控制台作废并重新生成。
- Demo 视频录制时不要展示 `.env` 内容。
- README 中只保留 `.env.example` 和配置步骤。

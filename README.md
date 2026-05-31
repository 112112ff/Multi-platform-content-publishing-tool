# ContentBridge 内容桥

ContentBridge 是一个面向创作者的多平台内容发布工具 MVP，对应比赛题目二“多平台内容发布工具”。用户用一句话告诉发布助理想发什么，系统会判断最合适的单个平台，生成平台化草稿，并引导用户确认账号后打开官方创作页完成发布。

## Demo 视频

```txt
待补充
```

建议录制脚本见 [docs/06-demo-script.md](./docs/06-demo-script.md)。

## 核心亮点

- 发布助理主流程：用户自然语言输入，MiniMax 增强生成单平台发布计划。
- 安全降级：未配置 MiniMax key 时，自动使用本地离线规则，项目仍可演示。
- 单平台账号确认：输入后只弹出当前目标平台账号，不再一次展示六个平台配置。
- 平台化改写：支持公众号、知乎、B站、小红书、微博、抖音。
- 发布体检：根据标题、平台类型、素材情况给出风险提示。
- 官方创作页路线：无需平台账号密码，打开用户自己的官方创作后台，并准备可复制草稿，最终由用户确认发布。
- 浏览器扩展 Publisher Bridge：作为增强能力复用用户自己的浏览器登录态，打开平台创作页并尝试填充草稿。
- 测试接收端：可真实 POST 到 webhook.site 或团队自建服务，验证发布 payload。
- 可扩展架构：新增平台可通过 `PlatformAdapter`、Agent 平台目录和发布桥扩展。

## MiniMax Agent

项目已接入 MiniMax OpenAI 兼容 Chat Completions API。为了避免 API key 暴露，前端不会直接请求 MiniMax，而是调用本地代理：

```txt
Browser UI -> local MiniMax proxy -> MiniMax API -> Agent JSON plan -> Browser UI
```

启用方式：

```bash
npm install
cp .env.example .env
# 在 .env 中填写 MINIMAX_API_KEY
# 中国大陆账号默认使用 https://api.minimaxi.com/v1/chat/completions
npm run dev:agent
```

普通前端启动方式：

```bash
npm run dev
```

如果未启动代理或未配置 key，页面会自动降级到本地离线规则。MiniMax 接入细节见 [docs/10-minimax-agent-integration.md](./docs/10-minimax-agent-integration.md)。

> 安全说明：真实 API key 不应提交到 GitHub。仓库最终公开后，提交过的 key 可能被平台风控禁用，也会产生被他人调用的费用风险。评审可直接运行离线规则流程；如需体验 MiniMax 增强生成，请在本机 `.env` 填写自己的 key，或由团队在演示环境中单独配置环境变量。

## 真实发布边界

正式发布到公众号、知乎、B站、小红书、微博、抖音通常需要平台开放接口、账号授权、内容审核和密钥配置。本 MVP 不伪造官方发布成功，而是提供三条可跑通链路：

1. 官方创作页路线：默认主流程，打开目标平台官方创作页，同时在本页准备可复制草稿，最终由用户人工确认发布。
2. 浏览器扩展路线：增强能力，把草稿发送给本地扩展，扩展打开平台创作页并尝试填充，最终由用户人工确认发布。
3. 测试接收端路线：把草稿真实 POST 到用户填写的接收 URL，用于验证 payload、状态处理和失败反馈。

浏览器扩展说明见 [extension/README.md](./extension/README.md)。

## 本地运行

```bash
npm install
npm run dev
```

默认访问：

```txt
http://127.0.0.1:5173/
```

构建与测试：

```bash
npm run build
npm run test:run
```

## 技术栈与依赖

运行依赖：

- React
- React DOM

开发依赖：

- TypeScript
- Vite
- Vitest
- @vitejs/plugin-react
- @types/react
- @types/react-dom

原创功能包括：MiniMax Agent 接入、本地 Agent 降级、单平台发布流程、平台适配器、发布体检、真实 Webhook 投递、浏览器扩展 Publisher Bridge、项目文档与协作规范。

## 文档导航

- [项目总览](./docs/00-project-overview.md)
- [产品与功能规划](./docs/01-product-plan.md)
- [架构设计](./docs/02-architecture-plan.md)
- [团队协作与分工](./docs/03-team-collaboration.md)
- [提交规则与验收清单](./docs/04-delivery-rules-checklist.md)
- [评审策略与得分点](./docs/05-review-strategy.md)
- [Demo 录制脚本](./docs/06-demo-script.md)
- [参赛提交说明](./docs/07-submission-brief.md)
- [Agent 单平台发布流程](./docs/09-agent-single-platform-flow.md)
- [MiniMax Agent 接入说明](./docs/10-minimax-agent-integration.md)
- [评委运行与提交说明](./docs/11-judge-runbook.md)
- [浏览器扩展 Publisher Bridge](./extension/README.md)

## 团队协作

本项目按比赛要求通过小粒度 PR 持续提交。每个 PR 只做一件事，PR 标题用一句话说明新增或修改内容，PR 描述必须包含功能描述、实现思路和测试方式。两人组队时，应确保两名队员都使用自己的 GitHub 账号提交 commit，并在 PR 备注中写清楚具体分工。每个 PR 合并后，`main` 分支必须保持可运行，评委在任意时间查看都应能复现演示效果。

## 比赛周期

```txt
2026-05-29 00:00 至 2026-05-31 23:59
```

所有 commit 必须落在上述时间范围内。开发过程必须持续通过 PR 和 commit 推进，不能最后一天一次性导入全部代码。

## 最终提交前检查

- 仓库在截止后改为 Public。
- README 中补充可播放的 Demo 视频链接。
- `npm install`、`npm run dev`、`npm run dev:agent`、`npm run build`、`npm run test:run` 可运行。
- README 列明依赖和原创功能边界。
- PR 描述完整且与代码变更一致。
- 两名队员均有各自账号的 commit 和 PR 记录。
- 没有提交 `.env`、密钥、账号密码等敏感信息。

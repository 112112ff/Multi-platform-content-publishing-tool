# ContentBridge 内容桥

ContentBridge 是一个面向创作者的多平台内容发布工具 MVP，对应比赛题目二“多平台内容发布工具”。用户输入一份内容后，系统会自动生成公众号、知乎、B站、小红书、微博、抖音等平台的发布版本，并整理成可编辑、可发布的多平台发布包。

## Demo 视频

```txt
提交前请替换为可播放的 B 站、网盘或公开视频链接。
```

线上体验地址：

```txt
https://contentbridge.onrender.com
```

Render 免费实例冷启动可能需要约 50 秒，页面打开后可点击“填入演示原文”快速体验完整链路。

建议录制脚本见 [docs/06-demo-script.md](./docs/06-demo-script.md)。

## 核心亮点

- 发布助理主流程：支持多轮自然语言沟通，结合完整对话生成多平台发布包。
- 原文改写入口：用户可直接粘贴已有文章、回答、产品介绍或带标签草稿，系统先识别标题、正文和标签，再做多平台适配。
- 多平台适配矩阵：同一份内容自动生成公众号长文、知乎问答、小红书笔记、B站简介、抖音口播、微博短观点。
- 发布偏好控制：支持长度、风格和热点方向选择，右侧各平台预览会按当前偏好重新生成。
- 选题素材：用户可粘贴热榜词、爆文标题或参考链接，系统按真实素材改写；未提供外部素材时只给平台化选题角度，不伪造实时热榜。
- 安全降级：未配置 MiniMax key 时，自动使用本地离线规则，项目仍可演示。
- 多平台发布队列：一键生成所有平台的发布状态，逐个平台查看草稿状态、打开官方创作页确认发布。
- 平台化改写：支持公众号、知乎、B站、小红书、微博、抖音。
- 发布体检：根据标题、平台类型、素材情况给出风险提示。
- 官方创作页路线：无需平台账号密码，打开用户自己的官方创作后台，并准备可复制草稿，最终由用户确认发布。
- 浏览器扩展 Publisher Bridge：作为增强能力复用用户自己的浏览器登录态，打开平台创作页并尝试填充草稿。
- 测试接收端：可真实 POST 到 webhook.site 或团队自建服务，验证发布 payload。
- 可扩展架构：新增平台可通过 `PlatformAdapter`、Agent 平台目录和发布桥扩展。

## AI 发布助理

如果希望用户下载项目后直接体验增强生成能力，可以部署线上代理服务，再把前端默认接口指向该代理。部署步骤见 [docs/12-online-agent-proxy.md](./docs/12-online-agent-proxy.md)。仓库只应保存代理 URL，不能保存真实 API key。

项目已接入 MiniMax OpenAI 兼容 Chat Completions API。为了避免 API key 暴露，前端不会直接请求 MiniMax，而是调用代理服务：

```txt
Browser UI -> Render / local MiniMax proxy -> MiniMax API -> multi-platform draft pack -> Browser UI
```

启用方式：

```bash
npm install
cp .env.example .env
# 在 .env 中填写 MINIMAX_API_KEY
# 中国大陆账号默认使用 https://api.minimaxi.com/v1/chat/completions
# npm run dev 默认连接 https://contentbridge.onrender.com
# npm run dev:agent 会连接 http://127.0.0.1:8787
npm run dev:agent
```

普通前端启动方式：

```bash
npm run dev
```

普通 `npm run dev` 默认会连接团队已部署的线上代理 `https://contentbridge.onrender.com`，因此用户在另一台电脑下载仓库后也能直接体验增强生成。若需要强制使用本机代理，可运行 `npm run dev:agent`，或在 `.env` 中设置 `VITE_AGENT_BASE_URL=http://127.0.0.1:8787`。

如果线上代理冷启动、未配置 key 或请求失败，页面会自动降级到本地离线规则。AI 发布助理接入细节见 [docs/10-minimax-agent-integration.md](./docs/10-minimax-agent-integration.md)。

> 安全说明：真实 API key 不应提交到 GitHub。仓库最终公开后，提交过的 key 可能被平台风控禁用，也会产生被他人调用的费用风险。用户可直接运行离线规则流程；如需体验增强生成，请在本机 `.env` 填写自己的 key，或使用团队部署的线上体验环境。

## 真实发布边界

正式发布到公众号、知乎、B站、小红书、微博、抖音通常需要平台开放接口、账号授权、内容审核和密钥配置。本 MVP 不伪造官方发布成功，而是提供三条可跑通链路：

1. 官方创作页路线：默认主流程，为所有目标平台生成草稿队列；用户选择平台后打开对应官方创作页，同时在本页准备可复制草稿，最终由用户人工确认发布。
2. 浏览器扩展路线：增强能力，把草稿发送给本地扩展，扩展打开平台创作页并尝试填充，最终由用户人工确认发布。
3. 测试接收端路线：把草稿真实 POST 到用户填写的接收 URL，用于验证 payload、状态处理和失败反馈。

浏览器扩展说明见 [extension/README.md](./extension/README.md)。

## 热点与趋势源设计

当前 MVP 不内置庞大的实时热点知识库，也不伪造热榜数据。产品采用“用户提供真实素材 + 可扩展趋势源”的设计：

- 当前可用：用户在发布 Brief 中粘贴热榜词、爆文标题、参考链接或选题素材，系统会把这些素材用于各平台标题、正文和标签改写。
- 默认兜底：如果没有外部素材，系统只提供平台化选题角度，例如真实案例、步骤清单、明确收益等，不声明实时热度。
- 未来扩展：可接入微博热搜、知乎热榜、B站热门、抖音热点榜或搜索 API，统一封装为 `TrendSource`，输出 `keyword/title/url/platform/sourceTime` 后交给发布助理生成。

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

原创功能包括：MiniMax 增强生成接入、本地离线规则降级、多轮发布助理、长度与风格偏好控制、热点建议、六平台发布流程、平台适配器、发布体检、真实 Webhook 投递、浏览器扩展 Publisher Bridge、项目文档与协作规范。

## 文档导航

产品与运行：

- [项目总览](./docs/00-project-overview.md)
- [产品与功能规划](./docs/01-product-plan.md)
- [架构设计](./docs/02-architecture-plan.md)
- [发布助理多平台发布流程](./docs/09-multi-platform-publishing-flow.md)
- [MiniMax Agent 接入说明](./docs/10-minimax-agent-integration.md)
- [运行与体验说明](./docs/11-user-runbook.md)
- [线上 AI 代理部署说明](./docs/12-online-agent-proxy.md)
- [浏览器扩展 Publisher Bridge](./extension/README.md)

提交材料：

- [开发协作与 PR 规范](./docs/03-team-collaboration.md)
- [Demo 录制脚本](./docs/06-demo-script.md)
- [参赛提交说明](./docs/07-submission-brief.md)

## 开发过程与 PR

本项目按比赛要求通过小粒度 PR 持续提交。每个 PR 只做一件事，PR 标题用一句话说明新增或修改内容，PR 描述必须包含功能描述、实现思路和测试方式。两人组队时，应确保两名队员都使用自己的 GitHub 账号提交 commit，并在 PR 备注中写清楚具体分工。每个 PR 合并后，`main` 分支必须保持可运行，用户在任意时间查看都应能复现演示效果。

当前核心交付分支：

```txt
codex/final-product-scope-polish
```

最终提交时请确认该分支已通过 PR 合并到 `main`，并且 `main` 可以直接 `npm install`、`npm run dev`、`npm run build`、`npm run test:run`。

## 比赛周期

```txt
2026-05-29 00:00 至 2026-05-31 23:59
```

所有 commit 必须落在上述时间范围内。开发过程必须持续通过 PR 和 commit 推进，不能最后一天一次性导入全部代码。

## 最终提交前检查

- 仓库在截止后改为 Public。
- README 中补充可播放的 Demo 视频链接。
- README 中保留线上体验地址，并确认隐身窗口可访问。
- `npm install`、`npm run dev`、`npm run dev:agent`、`npm run build`、`npm run test:run` 可运行。
- 线上环境 `https://contentbridge.onrender.com/api/agent-health` 返回 `configured=true`。
- README 列明依赖和原创功能边界。
- PR 描述完整且与代码变更一致。
- 两名队员均有各自账号的 commit 和 PR 记录。
- 没有提交 `.env`、密钥、账号密码等敏感信息。

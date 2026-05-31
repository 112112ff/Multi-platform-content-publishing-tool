# ContentBridge 内容桥

ContentBridge 是一个面向创作者的多平台内容发布工具 MVP。用户先用一句话告诉 Agent 想发什么、面向谁、发到哪些平台，系统再生成平台化改写版本，并提供爆品灵感、发布体检、账号矩阵任务、平台预览编辑、Webhook 真实投递和浏览器扩展 Publisher Bridge。

本项目对应题目二：多平台内容发布工具。

## Demo 视频

Demo 视频链接将在最终录制后补充到这里：

```txt
待补充
```

建议录制脚本见 [docs/06-demo-script.md](./docs/06-demo-script.md)。

## 核心亮点

- 一句话进入主流程：用户先和 Agent 对话，系统判断一个最合适的目标平台，再生成单平台草稿。
- 一次输入，多平台生成：同一份内容自动改写为 6 个平台版本。
- 爆品灵感库：未输入内容前展示小红书、知乎、B站、公众号、微博、短视频等内容形态拆解。
- 平台风格适配：不同平台生成不同标题、正文结构、标签和互动引导。
- 发布体检：按平台规则给出健康分、风险提示和修改建议。
- 账号矩阵任务：把平台账号抽象为账号通道，生成热点洞察、草稿准备和发布任务。
- Webhook 真实投递：可把适配后的内容真实 POST 到外部接收端，不伪造平台发布结果。
- 浏览器扩展 Publisher Bridge：复用用户自己的浏览器登录态，打开平台创作页并尝试填充草稿，适合国内平台 API 门槛高的真实接入路线。
- 可扩展架构：新增平台可通过 `PlatformAdapter` 和矩阵运营引擎扩展。

## 真实投递说明

正式发布到公众号、知乎、B站、小红书、微博、抖音通常需要平台开放接口、账号授权、内容审核和密钥配置。本 MVP 不伪造官方发布结果，而是提供两条可真实跑通、可继续扩展的投递链路。

### 路线一：Webhook 接收端

1. 前端 Agent 生成内容和平台任务。
2. 平台适配器生成各平台标题、正文、标签和健康分。
3. 用户填写真实接收端 URL，例如 `https://webhook.site/...`、团队自建后端、飞书/企业微信机器人中转服务。
4. 点击 `真实投递到接收端` 后，系统对每个平台任务执行真实 HTTP POST。
5. 接收端返回 2xx 记为成功，非 2xx 或网络错误记为失败；未填 URL 或发布体检未通过则阻断，不假装成功。

Webhook payload 包含：

```json
{
  "source": "ContentBridge",
  "mode": "real-webhook-delivery",
  "platformId": "wechat",
  "platformName": "公众号",
  "accountId": "wechat-official",
  "accountName": "公众号内容号",
  "executionRoute": "official-api",
  "authMode": "official-oauth",
  "title": "平台标题",
  "body": "平台正文",
  "summary": "摘要",
  "tags": ["标签"],
  "score": 90,
  "scheduledAt": "2026-05-30T10:00:00.000Z",
  "createdAt": "2026-05-30T00:00:00.000Z"
}
```

### 路线二：浏览器扩展 Publisher Bridge

国内内容平台常见问题是官方 API 不开放、权限门槛高或发布页变化频繁。项目因此补充了一个原创浏览器扩展路线：

```txt
ContentBridge Web App
  -> window.postMessage
  -> ContentBridge Publisher Bridge 浏览器扩展
  -> 复用用户自己的平台登录态
  -> 打开平台创作页并尝试填充标题、正文、标签
  -> 用户人工确认最终发布
```

使用方式见 [extension/README.md](./extension/README.md)。扩展不会保存账号密码、Cookie 或 token，也不会绕过平台审核。由于各平台页面 DOM 会变化，自动填充是尽力而为；如果没有成功填入，扩展会在页面右下角展示草稿面板供用户复制。

如果未来获得官方平台 API、OAuth、Cookie Vault 或更稳定的浏览器自动化权限，可以把 Webhook 接收端或扩展 Bridge 替换为带授权的 Publisher 服务，前端 Agent、平台适配器、发布体检和矩阵任务模型不需要重写。

## 功能清单

- Agent 对话：用户用自然语言描述主题、受众、平台和语气。
- 爆品拆解：展示不同平台内容为什么容易传播。
- 内容生成：根据用户一句话生成可编辑原始内容。
- 平台适配：公众号、知乎、B站、小红书、微博、抖音。
- 平台编辑：每个平台版本可单独修改。
- 平台预览：右侧实时查看生成后的标题、正文和标签。
- 发布体检：根据平台规则输出健康分、风险和建议。
- 账号连接：输入后只弹出当前目标平台账号确认，避免普通用户被六个平台配置打断。
- 热点洞察：根据平台任务生成热点方向和改写建议。
- 真实投递：真实发送 HTTP POST 到 Webhook / 自建服务 / 自动化机器人接收端，或发送到浏览器扩展 Bridge 打开平台创作页。

## 平台扩展方式

项目支持两层扩展方式：

1. 代码扩展：新增 `src/adapters/{platform}.ts`，实现 `PlatformAdapter` 的 `adapt`、`validate`、`publish`，再注册到 `registry.ts`。
2. 矩阵运营扩展：在 `src/integrations/matrixOperationEngine.ts` 中新增账号通道、授权模式、热点采集任务、发布执行路线和风控规则。

架构说明见 [docs/02-architecture-plan.md](./docs/02-architecture-plan.md)。

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

原创功能主要包括：Agent 对话入口、爆品灵感库、平台适配器架构、6 个内置平台规则、发布体检规则、账号矩阵运营引擎、Webhook 真实投递、浏览器扩展 Publisher Bridge、页面交互和项目文档。第三方库仅用于前端框架、构建和测试。

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

## 文档导航

- [项目总览](./docs/00-project-overview.md)
- [产品与功能规划](./docs/01-product-plan.md)
- [架构设计](./docs/02-architecture-plan.md)
- [团队协作与分工](./docs/03-team-collaboration.md)
- [提交规则与验收清单](./docs/04-delivery-rules-checklist.md)
- [评审策略与得分点](./docs/05-review-strategy.md)
- [Demo 录制脚本](./docs/06-demo-script.md)
- [参赛提交说明](./docs/07-submission-brief.md)
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
- `npm install`、`npm run dev`、`npm run build`、`npm run test:run` 可运行。
- README 列明依赖和原创功能边界。
- PR 描述完整且与代码变更一致。
- 两名队员均有各自账号的 commit 和 PR 记录。
- 没有提交 `.env`、密钥、账号密码等敏感信息。

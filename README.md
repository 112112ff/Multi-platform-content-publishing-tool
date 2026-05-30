# ContentBridge 内容桥

ContentBridge 是一个面向创作者的多平台内容发布工具 MVP。用户输入一份原始内容后，系统会自动生成公众号、知乎、B站、小红书、微博、抖音等平台的差异化版本，并提供发布体检、平台预览、人工编辑、发布编排、本地发布记录、Webhook 真实投递和自定义平台扩展能力。

本项目对应题目二：多平台内容发布工具。

## Demo 视频

Demo 视频链接将在最终录制后补充到这里：

```txt
待补充
```

建议录制脚本见 [docs/06-demo-script.md](./docs/06-demo-script.md)。

## 核心亮点

- 一次输入，多平台生成：同一份内容自动改写为 6 个平台版本。
- 发布助手 Agent：用户可以用一句话触发载入示例、选择平台、生成初稿、配置外部接收端和新增平台。
- 平台风格适配：不同平台生成不同标题、正文结构、标签和互动引导。
- 发布体检：按平台规则给出健康分、风险提示和修改建议。
- 发布工作台：支持平台切换、编辑/预览切换、恢复生成版本、复制 Markdown、导出全部平台内容。
- 发布编排：展示每个平台的就绪、待补素材、阻塞、发布中、成功、草稿、失败状态。
- Webhook 真实投递：可把适配后的内容真实 POST 到外部接收端，不只是按钮模拟。
- 自定义平台接入：页面内配置平台规则后，动态生成新的 `PlatformAdapter`，立即进入适配、体检、队列和投递流程。
- 可扩展架构：新增平台可通过代码适配器或页面配置两种方式完成。

## 真实投递说明

正式发布到公众号、知乎、B站、小红书、微博、抖音通常需要平台开放接口、账号授权、内容审核和密钥配置。本 MVP 不伪造官方发布结果，而是提供两种可验证通道：

1. 本地演示：使用平台适配器完成格式改写、规则校验、发布队列和历史记录。
2. Webhook 实发：选择 `Webhook 实发`，填写 `https://webhook.site/...`、团队自建后端、飞书/企业微信机器人中转服务等地址，点击发布后对每个平台执行真实 HTTP POST。

Webhook payload 包含：

```json
{
  "source": "ContentBridge",
  "platformId": "wechat",
  "platformName": "公众号",
  "title": "平台标题",
  "body": "平台正文",
  "summary": "摘要",
  "tags": ["标签"],
  "score": 90,
  "createdAt": "2026-05-30T00:00:00.000Z"
}
```

如果接收端返回 2xx，系统记录为成功；否则记录失败原因。未来接入官方平台时，只需要把 Webhook 接收端替换为带授权的发布服务，前端适配器、体检和发布编排不需要重写。

## 功能清单

- 内容输入：标题、正文、标签、封面图、视频链接、目标平台。
- 发布助手：通过本地规则 Agent 执行“载入示例”“选择平台”“设置外部接收端”“新增快手平台”等指令。
- 流程引导：顶部虚线流程框提示输入、选平台、体检编辑、投递验证四个步骤。
- 示例内容：一键载入 Demo 内容。
- 平台适配：公众号、知乎、B站、小红书、微博、抖音。
- 平台编辑：每个平台版本可单独修改。
- 平台预览：查看生成后的标题、正文和标签。
- 发布体检：根据平台规则输出健康分、风险和建议。
- 发布编排：展示平台任务状态、预计处理时间和下一步动作。
- 本地演示发布：稳定展示成功、草稿、失败和历史记录。
- 外部接收端实发：真实发送 HTTP POST 到 Webhook / 自建服务 / 自动化机器人接收端。
- 自定义平台：动态生成自定义平台适配器。
- 本地持久化：草稿、人工编辑内容、发布记录、Webhook 配置、自定义平台配置会保存到浏览器 localStorage。
- Markdown 导出：复制当前平台 Markdown 或导出全部平台 Markdown。

## 平台扩展方式

项目支持两种扩展方式：

1. 代码扩展：新增 `src/adapters/{platform}.ts`，实现 `PlatformAdapter` 的 `adapt`、`validate`、`publish`，再注册到 `registry.ts`。
2. 页面配置扩展：在“自定义平台接入中心”填写平台规则，系统通过 `createCustomPlatformAdapter` 动态生成适配器，并立即加入适配预览、发布体检、发布队列和 Webhook 投递。

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

原创功能主要包括：平台适配器架构、6 个内置平台规则、发布体检规则、发布编排状态、Webhook 真实投递、自定义平台动态适配器、工作台交互和项目文档。第三方库仅用于前端框架、构建和测试。

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

## 团队协作

本项目按比赛要求通过小粒度 PR 持续提交。每个 PR 描述包含功能描述、实现思路、测试方式和分工说明。两人组队时，应确保两名队员都使用自己的 GitHub 账号提交 commit，并在 PR 描述中写清楚分工。

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

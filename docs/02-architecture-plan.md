# 架构设计

## 架构目标

本项目的核心架构目标是让“新增平台”变得简单。主流程不应该关心公众号、知乎、B站、小红书的具体细节，而是通过统一的适配器接口调用每个平台能力。

## 推荐目录结构

```txt
src/
  adapters/
    base.ts
    registry.ts
    wechat.ts
    zhihu.ts
    bilibili.ts
    xiaohongshu.ts
  components/
    ContentEditor.tsx
    PlatformSelector.tsx
    PlatformPreview.tsx
    HealthScore.tsx
    PublishPanel.tsx
    PublishHistory.tsx
  data/
    sampleContent.ts
    platformProfiles.ts
  services/
    adaptContent.ts
    publishSimulator.ts
    storage.ts
  types/
    content.ts
    platform.ts
  App.tsx
  main.tsx
```

## 核心数据流

```txt
ContentInput
  -> PlatformAdapter.adapt()
  -> AdaptedContent
  -> PlatformAdapter.validate()
  -> ValidationResult + HealthScore
  -> publishSimulator.publish()
  -> PublishResult
  -> PublishHistory
```

## 核心类型设计

```ts
export interface ContentInput {
  title: string;
  body: string;
  tags: string[];
  coverUrl?: string;
  videoUrl?: string;
  selectedPlatformIds: string[];
}

export interface AdaptedContent {
  platformId: string;
  title: string;
  body: string;
  summary?: string;
  tags: string[];
  strategyNotes: string[];
}

export interface ValidationIssue {
  level: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  score: number;
  canPublish: boolean;
  issues: ValidationIssue[];
}

export interface PublishResult {
  id: string;
  platformId: string;
  status: "success" | "failed" | "draft";
  url?: string;
  message: string;
  createdAt: string;
  score: number;
}
```

## 平台适配器接口

```ts
export interface PlatformAdapter {
  id: string;
  name: string;
  profile: PlatformProfile;
  adapt(input: ContentInput): AdaptedContent;
  validate(content: AdaptedContent, input: ContentInput): ValidationResult;
  publish(content: AdaptedContent, validation: ValidationResult): Promise<PublishResult>;
}
```

## 注册机制

所有平台都在 `registry.ts` 中注册。

```ts
import { wechatAdapter } from "./wechat";
import { zhihuAdapter } from "./zhihu";
import { bilibiliAdapter } from "./bilibili";
import { xiaohongshuAdapter } from "./xiaohongshu";

export const platformAdapters = [
  wechatAdapter,
  zhihuAdapter,
  bilibiliAdapter,
  xiaohongshuAdapter,
];
```

前端只读取 `platformAdapters`，不手写具体平台判断。这样新增平台时，主界面无需大改。

## 如何新增平台

以新增微博为例：

1. 在 `src/adapters/weibo.ts` 中创建 `weiboAdapter`。
2. 实现 `adapt`，生成微博风格内容。
3. 实现 `validate`，检查字数、话题、图片等规则。
4. 实现 `publish`，MVP 阶段返回模拟发布结果。
5. 在 `registry.ts` 中注册 `weiboAdapter`。
6. 如有特殊展示信息，在 `platformProfiles.ts` 中补充平台资料。

## 当前 MVP 的技术取舍

### 使用规则引擎

本期先使用规则和模板完成平台适配，保证稳定可演示。

优势：

- 不依赖外部 API。
- Demo 不受网络和模型响应影响。
- 适配逻辑可解释，便于 README 和路演说明。

### 后续可接入大模型

后续可以把 `adapt` 的内部实现替换为大模型调用，但外部接口保持不变：

```txt
PlatformAdapter.adapt()
  当前：规则模板
  后续：规则模板 + LLM 改写
```

这意味着主流程、预览、校验、发布模拟都不需要重写。

## 健壮性要求

- 表单输入必须有默认值和空状态。
- 校验规则不能让页面崩溃。
- 缺少封面或视频链接时应给出提示，而不是阻塞全部平台。
- 发布模拟失败要展示原因。
- 主分支每次合并后必须能 `npm install`、`npm run dev`、`npm run build`。

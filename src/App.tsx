import { useEffect, useState } from "react";
import { ContentEditor } from "./components/ContentEditor";
import { PlatformPreviewGrid } from "./components/PlatformPreviewGrid";
import { createCustomPlatformAdapter } from "./adapters/customAdapter";
import { platformAdapters } from "./adapters/registry";
import { emptyContentInput, sampleContentInput } from "./data/sampleContent";
import { adaptContentForSelectedPlatforms } from "./services/adaptContent";
import type { AdaptedContent, ContentInput, PublishResult } from "./types/content";
import type { PlatformPreview } from "./services/adaptContent";
import type { CustomPlatformConfig } from "./types/platform";

type DeliveryMode = "local" | "webhook";

interface PublishBatch {
  id: string;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
  deliveryMode?: DeliveryMode;
  results: PublishResult[];
}

const storageKey = "contentbridge-draft-v2";

const emptyCustomPlatformDraft = {
  name: "",
  positioning: "",
  contentStrategy: "",
  tone: "",
  requiredAsset: "none" as CustomPlatformConfig["requiredAsset"],
  maxTitleLength: 32,
  tagHintsText: "",
};

const workflowSteps = [
  "输入原始内容",
  "选择目标平台",
  "生成平台版本",
  "发布体检",
  "模拟发布",
];

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const formatDuration = (durationMs?: number) => {
  if (!durationMs) {
    return "未开始";
  }

  return durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
};

const formatTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(value))
    : "--";

const statusLabel: Record<string, string> = {
  ready: "就绪",
  "needs-material": "待补素材",
  blocked: "阻塞",
};

const agentExamples = [
  "载入示例内容，选择公众号、知乎、小红书",
  "我要真实投递到 https://webhook.site/xxx",
  "新增一个快手平台，短视频社区，需要视频",
  "帮我写一篇关于 AI 学习效率的内容",
];

const platformAlias: Record<string, string> = {
  公众号: "wechat",
  微信: "wechat",
  知乎: "zhihu",
  B站: "bilibili",
  哔哩哔哩: "bilibili",
  小红书: "xiaohongshu",
  微博: "weibo",
  抖音: "douyin",
};

const extractUrl = (value: string) => value.match(/https?:\/\/\S+/)?.[0] ?? "";

const readStoredDraft = () => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as {
      content?: ContentInput;
      editedContent?: Record<string, AdaptedContent>;
      publishBatches?: PublishBatch[];
      deliveryMode?: DeliveryMode;
      webhookUrl?: string;
      customPlatforms?: CustomPlatformConfig[];
    };
  } catch {
    return null;
  }
};

const createDeliveryResult = (
  preview: PlatformPreview,
  result: Partial<PublishResult>,
): PublishResult => ({
  id: `${preview.adapted.platformId}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`,
  platformId: preview.adapted.platformId,
  status: result.status ?? "draft",
  url: result.url,
  message: result.message ?? "已生成发布结果。",
  createdAt: new Date().toISOString(),
  score: preview.validation.score,
});

function App() {
  const storedDraft = readStoredDraft();
  const [content, setContent] = useState<ContentInput>(
    storedDraft?.content ?? emptyContentInput,
  );
  const [publishBatches, setPublishBatches] = useState<PublishBatch[]>(
    storedDraft?.publishBatches ?? [],
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(
    storedDraft?.deliveryMode ?? "local",
  );
  const [webhookUrl, setWebhookUrl] = useState(storedDraft?.webhookUrl ?? "");
  const [customPlatforms, setCustomPlatforms] = useState<CustomPlatformConfig[]>(
    storedDraft?.customPlatforms ?? [],
  );
  const [customPlatformDraft, setCustomPlatformDraft] = useState(
    emptyCustomPlatformDraft,
  );
  const [agentInput, setAgentInput] = useState("");
  const [agentMessages, setAgentMessages] = useState<string[]>([
    "你可以直接说目标，例如：载入示例、选择平台、设置外部接收端、新增快手平台。",
  ]);
  const [showAdvancedWorkspace, setShowAdvancedWorkspace] = useState(false);
  const [showCustomPlatformCenter, setShowCustomPlatformCenter] = useState(false);
  const [publishProgress, setPublishProgress] = useState<Record<string, string>>({});
  const [editedContent, setEditedContent] = useState<Record<string, AdaptedContent>>(
    storedDraft?.editedContent ?? {},
  );
  const customAdapters = customPlatforms.map(createCustomPlatformAdapter);
  const allAdapters = [...platformAdapters, ...customAdapters];
  const platformOptions = allAdapters.map((adapter) => ({
    id: adapter.id,
    name: adapter.name,
  }));
  const generatedPreviews = adaptContentForSelectedPlatforms(content, customAdapters);
  const previews: PlatformPreview[] = generatedPreviews.map((preview) => {
    const adapted = editedContent[preview.adapted.platformId] ?? preview.adapted;
    return {
      ...preview,
      adapted,
      validation: preview.adapter.validate(adapted, content),
    };
  });
  const hasContent = Boolean(content.title.trim() || content.body.trim());
  const averageScore = previews.length
    ? Math.round(
        previews.reduce((sum, preview) => sum + preview.validation.score, 0) /
          previews.length,
      )
    : 0;
  const blockedCount = previews.filter(
    (preview) => !preview.validation.canPublish,
  ).length;
  const publishHistory = publishBatches.flatMap((batch) => batch.results);
  const latestBatch = publishBatches[0];
  const latestSummary = latestBatch
    ? {
        success: latestBatch.results.filter((result) => result.status === "success")
          .length,
        draft: latestBatch.results.filter((result) => result.status === "draft").length,
        failed: latestBatch.results.filter((result) => result.status === "failed")
          .length,
      }
    : null;
  const publishPlan = previews.map((preview, index) => {
    const platformId = preview.adapted.platformId;
    const hasBlockingIssue = !preview.validation.canPublish;
    const needsVideo =
      (platformId === "bilibili" || platformId === "douyin") && !content.videoUrl;
    const status = hasBlockingIssue
      ? "blocked"
      : needsVideo
        ? "needs-material"
        : "ready";
    const progress = publishProgress[platformId];
    const progressTone =
      progress === "成功"
        ? "success"
        : progress === "草稿"
          ? "draft"
          : progress === "失败"
            ? "failed"
            : progress === "发布中"
              ? "running"
              : status;

    return {
      platformId,
      platformName: preview.platformName,
      score: preview.validation.score,
      status,
      progress,
      progressTone,
      etaSeconds: 8 + index * 3 + preview.validation.issues.length * 2,
      nextAction: hasBlockingIssue
        ? "处理阻塞项后再发布"
        : needsVideo
          ? "可先保存草稿，补视频后正式发布"
          : "可进入模拟发布队列",
    };
  });
  const readyCount = publishPlan.filter((item) => item.status === "ready").length;
  const draftCandidateCount = publishPlan.filter(
    (item) => item.status === "needs-material",
  ).length;
  const guidedSteps = [
    {
      title: "1. 输入内容",
      detail: hasContent ? "已获得原始内容" : "先输入正文或载入示例",
      done: hasContent,
    },
    {
      title: "2. 选择平台",
      detail: previews.length ? `${previews.length} 个平台已进入队列` : "至少选择一个目标平台",
      done: previews.length > 0,
    },
    {
      title: "3. 体检与编辑",
      detail: hasContent
        ? blockedCount
          ? `${blockedCount} 个阻塞项需要处理`
          : `平均健康分 ${averageScore}`
        : "生成后查看风险和建议",
      done: hasContent && previews.length > 0 && blockedCount === 0,
    },
    {
      title: "4. 投递验证",
      detail:
        deliveryMode === "webhook"
          ? webhookUrl
            ? "已配置外部接收端"
            : "等待填写外部接收端 URL"
          : "当前为本地演示通道",
      done: deliveryMode === "webhook" ? Boolean(webhookUrl.trim()) : publishHistory.length > 0,
    },
  ];
  const selectedPlatformNames = previews.map((preview) => preview.platformName);
  const assistantSummary = {
    intent: hasContent ? "已识别到待发布内容" : "等待你描述要发布的内容",
    audience: content.tags.length ? content.tags.slice(0, 3).join("、") : "可在一句话里说明目标人群",
    platforms: selectedPlatformNames.length
      ? selectedPlatformNames.join("、")
      : "助手会根据需求选择平台",
    nextStep: !hasContent
      ? "先告诉助手你要发布什么"
      : blockedCount
        ? "先处理发布体检里的阻塞项"
        : deliveryMode === "webhook" && !webhookUrl
          ? "填写外部接收端地址"
          : "可以预览平台版本或开始投递",
  };

  const publishAll = async () => {
    if (!hasContent || !previews.length) {
      return;
    }

    setIsPublishing(true);
    const batchStartedAt = Date.now();
    const results: PublishResult[] = [];

    for (const preview of previews) {
      setPublishProgress((current) => ({
        ...current,
        [preview.adapted.platformId]: "发布中",
      }));
      await wait(260);
      const result =
        deliveryMode === "webhook"
          ? await publishToWebhook(preview)
          : await preview.adapter.publish(preview.adapted, preview.validation);
      results.push(result);
      setPublishProgress((current) => ({
        ...current,
        [preview.adapted.platformId]:
          result.status === "success"
            ? "成功"
            : result.status === "draft"
              ? "草稿"
              : "失败",
      }));
      await wait(160);
    }

    const completedAt = new Date().toISOString();
    const batch: PublishBatch = {
      id: `batch-${Date.now()}`,
      createdAt: new Date(batchStartedAt).toISOString(),
      completedAt,
      durationMs: Date.now() - batchStartedAt,
      deliveryMode,
      results,
    };
    setPublishBatches((current) => [batch, ...current].slice(0, 8));
    setIsPublishing(false);
    window.setTimeout(() => setPublishProgress({}), 1600);
  };

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        content,
        editedContent,
        publishBatches,
        deliveryMode,
        webhookUrl,
        customPlatforms,
      }),
    );
  }, [
    content,
    editedContent,
    publishBatches,
    deliveryMode,
    webhookUrl,
    customPlatforms,
  ]);

  const publishToWebhook = async (preview: PlatformPreview) => {
    if (!webhookUrl.trim()) {
      return createDeliveryResult(preview, {
        status: "failed",
        message: "Webhook 地址为空，无法执行真实投递。",
      });
    }

    if (!preview.validation.canPublish) {
      return createDeliveryResult(preview, {
        status: "failed",
        message: "发布体检未通过，已阻止 Webhook 投递。",
      });
    }

    try {
      const response = await fetch(webhookUrl.trim(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "ContentBridge",
          platformId: preview.adapted.platformId,
          platformName: preview.platformName,
          title: preview.adapted.title,
          body: preview.adapted.body,
          summary: preview.adapted.summary,
          tags: preview.adapted.tags,
          score: preview.validation.score,
          createdAt: new Date().toISOString(),
        }),
      });

      return createDeliveryResult(preview, {
        status: response.ok ? "success" : "failed",
        url: webhookUrl.trim(),
        message: response.ok
          ? `已真实 POST 到 Webhook，状态码 ${response.status}。`
          : `Webhook 返回 ${response.status}，请检查接收端配置。`,
      });
    } catch (error) {
      return createDeliveryResult(preview, {
        status: "failed",
        url: webhookUrl.trim(),
        message:
          error instanceof Error
            ? `Webhook 投递失败：${error.message}`
            : "Webhook 投递失败，请检查网络、CORS 或接收端。",
      });
    }
  };

  const changeContent = (nextContent: ContentInput) => {
    setContent(nextContent);
    setEditedContent({});
  };

  const updatePlatformContent = (
    platformId: string,
    patch: Partial<AdaptedContent>,
  ) => {
    const baseContent = previews.find(
      (preview) => preview.adapted.platformId === platformId,
    )?.adapted;

    if (!baseContent) {
      return;
    }

    setEditedContent((current) => ({
      ...current,
      [platformId]: {
        ...baseContent,
        ...patch,
      },
    }));
  };

  const resetPlatformContent = (platformId: string) => {
    setEditedContent((current) => {
      const next = { ...current };
      delete next[platformId];
      return next;
    });
  };

  const addCustomPlatform = () => {
    const name = customPlatformDraft.name.trim();
    if (!name) {
      return;
    }

    const id = `custom-${Date.now()}`;
    const nextPlatform: CustomPlatformConfig = {
      id,
      name,
      positioning:
        customPlatformDraft.positioning.trim() || `${name} 自定义发布渠道`,
      contentStrategy:
        customPlatformDraft.contentStrategy.trim() ||
        "保留核心观点，按平台语气重组标题、正文和标签。",
      tone: customPlatformDraft.tone.trim() || "清晰、直接、便于传播",
      requiredAsset: customPlatformDraft.requiredAsset,
      maxTitleLength: Number(customPlatformDraft.maxTitleLength) || 32,
      tagHints: customPlatformDraft.tagHintsText
        .split(/[,，\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    setCustomPlatforms((current) => [...current, nextPlatform]);
    setContent((current) => ({
      ...current,
      selectedPlatformIds: [...current.selectedPlatformIds, id],
    }));
    setCustomPlatformDraft(emptyCustomPlatformDraft);
  };

  const addCustomPlatformFromAgent = (
    name: string,
    requiredAsset: CustomPlatformConfig["requiredAsset"],
  ) => {
    const id = `custom-${Date.now()}`;
    const nextPlatform: CustomPlatformConfig = {
      id,
      name,
      positioning: requiredAsset === "video" ? "短视频内容渠道" : "自定义内容渠道",
      contentStrategy:
        requiredAsset === "video"
          ? "强开场、短句表达、保留互动引导和行动建议。"
          : "保留核心观点，按平台语气重组标题、正文和标签。",
      tone: requiredAsset === "video" ? "轻快、直接、有行动感" : "清晰、直接、便于传播",
      requiredAsset,
      maxTitleLength: requiredAsset === "video" ? 24 : 32,
      tagHints: requiredAsset === "video" ? ["短视频", "经验分享"] : ["内容分发"],
    };

    setCustomPlatforms((current) => [...current, nextPlatform]);
    setContent((current) => ({
      ...current,
      selectedPlatformIds: [...new Set([...current.selectedPlatformIds, id])],
    }));
    return nextPlatform.name;
  };

  const removeCustomPlatform = (platformId: string) => {
    setCustomPlatforms((current) =>
      current.filter((platform) => platform.id !== platformId),
    );
    setContent((current) => ({
      ...current,
      selectedPlatformIds: current.selectedPlatformIds.filter(
        (id) => id !== platformId,
      ),
    }));
    setEditedContent((current) => {
      const next = { ...current };
      delete next[platformId];
      return next;
    });
  };

  const getPlatformName = (platformId: string) =>
    allAdapters.find((adapter) => adapter.id === platformId)?.name ?? platformId;

  const runAgentCommand = async (rawCommand = agentInput) => {
    const command = rawCommand.trim();
    if (!command) {
      return;
    }

    const replies: string[] = [];
    const url = extractUrl(command);

    if (command.includes("示例") || command.includes("demo") || command.includes("Demo")) {
      changeContent(sampleContentInput);
      replies.push("已载入示例内容，并生成默认 6 平台任务。");
    }

    if (command.includes("清空") || command.includes("重置")) {
      changeContent(emptyContentInput);
      replies.push("已清空当前内容和人工编辑版本。");
    }

    const selectedPlatformIds = Object.entries(platformAlias)
      .filter(([alias]) => command.includes(alias))
      .map(([, platformId]) => platformId);
    if (selectedPlatformIds.length) {
      setContent((current) => ({
        ...current,
        selectedPlatformIds: [...new Set(selectedPlatformIds)],
      }));
      replies.push(
        `已按你的要求选择：${selectedPlatformIds
          .map((id) => getPlatformName(id))
          .join("、")}。`,
      );
    }

    if (command.includes("全部平台") || command.includes("全平台")) {
      setContent((current) => ({
        ...current,
        selectedPlatformIds: allAdapters.map((adapter) => adapter.id),
      }));
      replies.push("已选择当前所有平台，包括自定义平台。");
    }

    if (url) {
      setDeliveryMode("webhook");
      setWebhookUrl(url);
      replies.push("已切换到外部接收端投递，并填入你提供的 URL。");
    } else if (
      command.includes("真实") ||
      command.includes("投递") ||
      command.includes("webhook") ||
      command.includes("Webhook")
    ) {
      setDeliveryMode("webhook");
      replies.push("已切换到外部接收端投递。你还需要填写一个接收地址，例如 webhook.site 生成的 URL。");
    }

    if (command.includes("本地") || command.includes("模拟")) {
      setDeliveryMode("local");
      replies.push("已切换到本地演示通道，适合稳定录制 Demo。");
    }

    const customPlatformName = ["快手", "今日头条", "头条", "LinkedIn", "公众号矩阵"].find(
      (name) => command.includes(name),
    );
    if (customPlatformName && !platformOptions.some((platform) => platform.name === customPlatformName)) {
      const createdName = addCustomPlatformFromAgent(
        customPlatformName === "头条" ? "今日头条" : customPlatformName,
        command.includes("视频") || command.includes("短视频") ? "video" : "none",
      );
      replies.push(`已新增自定义平台：${createdName}，并加入发布队列。`);
    }

    if (command.includes("写") || command.includes("生成一篇") || command.includes("准备一篇")) {
      const topic = command
        .replace(/帮我|请|写一篇|生成一篇|准备一篇|内容|关于|的/g, " ")
        .replace(url, "")
        .trim();
      const title = topic ? `${topic}：一份可复用的发布草稿` : "一份可复用的多平台发布草稿";
      setContent((current) => ({
        ...current,
        title,
        body: [
          `这是一份围绕“${topic || "当前主题"}”生成的初稿。`,
          "核心观点是：先明确目标受众，再按平台语境调整表达方式，而不是把同一段文字机械复制到所有平台。",
          "执行时可以先沉淀一份完整正文，再分别生成长图文、问答、短视频脚本、种草笔记和短内容传播版本。",
          "发布前需要检查标题长度、素材是否齐全、标签是否足够，以及是否有明确的互动引导。",
        ].join("\n\n"),
        tags: topic ? [topic, "内容分发", "效率工具"] : ["内容分发", "效率工具"],
      }));
      replies.push("已根据你的描述生成一份可继续编辑的原始内容。");
    }

    if (command.includes("发布") && hasContent && previews.length) {
      replies.push("已收到发布意图。为避免误发，我已准备好队列，请你点击主按钮确认投递。");
    }

    if (!replies.length) {
      replies.push(
        "我理解得还不够明确。你可以说：载入示例、选择小红书和抖音、设置 Webhook URL、新增快手平台，或帮我写一篇关于某主题的内容。",
      );
    }

    setAgentMessages((current) => [`你：${command}`, ...replies, ...current].slice(0, 8));
    setAgentInput("");
  };

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">ContentBridge MVP</p>
          <h1 id="product-title">一句话生成多平台发布方案</h1>
          <p className="lead">
            面向普通创作者的内容发布助手。先说清楚你想发什么，系统再帮你改写、选平台、检查风险和准备投递。
          </p>
        </div>
        <div className="delivery-console">
          <label>
            发布通道
            <select
              value={deliveryMode}
              onChange={(event) =>
                setDeliveryMode(event.target.value as DeliveryMode)
              }
            >
              <option value="local">本地演示</option>
              <option value="webhook">外部接收端实发</option>
            </select>
          </label>
          {deliveryMode === "webhook" ? (
            <label>
              接收端 URL
              <input
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                placeholder="https://webhook.site/..."
              />
            </label>
          ) : null}
          <button
            type="button"
            className="publish-button"
            disabled={!hasContent || !previews.length || isPublishing}
            onClick={publishAll}
          >
            {isPublishing
              ? "发布中..."
              : deliveryMode === "webhook"
                ? "投递到外部接收端"
                : "模拟一键发布"}
          </button>
          <p className="delivery-hint">
            外部接收端就是能接收 HTTP POST 的地址，录 Demo 可用 webhook.site 验证真实投递。
          </p>
        </div>
      </header>

      <section className="status-strip" aria-label="发布状态概览">
        <div>
          <span>{previews.length}</span>
          <p>目标平台</p>
        </div>
        <div>
          <span>{hasContent ? averageScore : "--"}</span>
          <p>平均健康分</p>
        </div>
        <div>
          <span>{blockedCount}</span>
          <p>阻塞问题</p>
        </div>
        <div>
          <span>{publishHistory.length}</span>
          <p>发布记录</p>
        </div>
      </section>

      <section className="agent-panel primary-agent" aria-labelledby="agent-title">
        <div>
          <span className="section-label">发布助手 Agent</span>
          <h2 id="agent-title">先告诉我你的发布目标</h2>
          <p>
            不需要先理解平台规则。你可以直接描述内容、受众、想发的平台或投递方式，助手会分析需求并调用对应功能。
          </p>
          <div className="agent-examples">
            {agentExamples.map((example) => (
              <button
                type="button"
                key={example}
                onClick={() => runAgentCommand(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
        <form
          className="agent-command"
          onSubmit={(event) => {
            event.preventDefault();
            void runAgentCommand();
          }}
        >
          <label>
            用一句话描述需求
            <textarea
              value={agentInput}
              onChange={(event) => setAgentInput(event.target.value)}
              placeholder="例如：我想发一篇给大学生看的 AI 学习效率内容，重点发小红书和抖音"
              rows={4}
            />
          </label>
          <button type="submit" className="publish-button">
            让助手分析并执行
          </button>
          <div className="assistant-summary" aria-label="助手需求理解">
            <div>
              <span>需求状态</span>
              <strong>{assistantSummary.intent}</strong>
            </div>
            <div>
              <span>受众/标签</span>
              <strong>{assistantSummary.audience}</strong>
            </div>
            <div>
              <span>目标平台</span>
              <strong>{assistantSummary.platforms}</strong>
            </div>
            <div>
              <span>建议下一步</span>
              <strong>{assistantSummary.nextStep}</strong>
            </div>
          </div>
          <div className="agent-log" aria-live="polite">
            {agentMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        </form>
      </section>

      <section className="guided-flow" aria-label="演示流程引导">
        {guidedSteps.map((step, index) => (
          <div
            className={step.done ? "flow-card done" : "flow-card"}
            key={step.title}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.title}</strong>
            <p>{step.detail}</p>
          </div>
        ))}
      </section>

      <section className="mode-switcher" aria-label="高级功能入口">
        <div>
          <span className="section-label">可选操作</span>
          <h2>需要更细控制时再展开</h2>
          <p>普通用户可以只用上面的助手完成主流程；高级编辑、逐平台调稿和新增平台都放在这里。</p>
        </div>
        <div className="button-row">
          <button
            type="button"
            onClick={() => setShowAdvancedWorkspace((current) => !current)}
          >
            {showAdvancedWorkspace ? "收起高级工作台" : "编辑平台版本"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowCustomPlatformCenter((current) => !current)}
          >
            {showCustomPlatformCenter ? "收起平台扩展" : "添加更多平台"}
          </button>
        </div>
      </section>

      {showAdvancedWorkspace ? (
        <section className="workspace" aria-label="高级工作台">
          <aside className="editor-preview">
            <ContentEditor
              content={content}
              platformOptions={platformOptions}
              onChange={changeContent}
              onLoadSample={() => changeContent(sampleContentInput)}
              onReset={() => changeContent(emptyContentInput)}
            />
          </aside>

          <PlatformPreviewGrid
            previews={previews}
            hasContent={hasContent}
            onUpdateContent={updatePlatformContent}
            onResetContent={resetPlatformContent}
            editedPlatformIds={Object.keys(editedContent)}
          />
        </section>
      ) : null}

      {showCustomPlatformCenter ? (
      <section className="extension-center" aria-labelledby="extension-title">
        <div>
          <span className="section-label">平台扩展</span>
          <h2 id="extension-title">自定义平台接入中心</h2>
          <p>
            输入平台定位、内容策略和素材要求后，系统会实时生成一个新的
            PlatformAdapter，并加入适配、体检、发布队列和 Webhook 投递。
          </p>
        </div>
        <div className="extension-form">
          <label>
            平台名称
            <input
              value={customPlatformDraft.name}
              onChange={(event) =>
                setCustomPlatformDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="例如：快手 / 今日头条 / LinkedIn"
            />
          </label>
          <label>
            平台定位
            <input
              value={customPlatformDraft.positioning}
              onChange={(event) =>
                setCustomPlatformDraft((current) => ({
                  ...current,
                  positioning: event.target.value,
                }))
              }
              placeholder="例如：短视频社区、专业内容网络"
            />
          </label>
          <label>
            内容策略
            <input
              value={customPlatformDraft.contentStrategy}
              onChange={(event) =>
                setCustomPlatformDraft((current) => ({
                  ...current,
                  contentStrategy: event.target.value,
                }))
              }
              placeholder="例如：强开场、短句、引导评论"
            />
          </label>
          <label>
            语气
            <input
              value={customPlatformDraft.tone}
              onChange={(event) =>
                setCustomPlatformDraft((current) => ({
                  ...current,
                  tone: event.target.value,
                }))
              }
              placeholder="例如：轻快、专业、强行动感"
            />
          </label>
          <label>
            必需素材
            <select
              value={customPlatformDraft.requiredAsset}
              onChange={(event) =>
                setCustomPlatformDraft((current) => ({
                  ...current,
                  requiredAsset: event.target
                    .value as CustomPlatformConfig["requiredAsset"],
                }))
              }
            >
              <option value="none">无</option>
              <option value="cover">封面图</option>
              <option value="video">视频</option>
            </select>
          </label>
          <label>
            标题字数上限
            <input
              type="number"
              min="8"
              max="120"
              value={customPlatformDraft.maxTitleLength}
              onChange={(event) =>
                setCustomPlatformDraft((current) => ({
                  ...current,
                  maxTitleLength: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            推荐标签
            <input
              value={customPlatformDraft.tagHintsText}
              onChange={(event) =>
                setCustomPlatformDraft((current) => ({
                  ...current,
                  tagHintsText: event.target.value,
                }))
              }
              placeholder="用逗号分隔，例如：效率工具，经验分享"
            />
          </label>
          <button type="button" className="publish-button" onClick={addCustomPlatform}>
            接入自定义平台
          </button>
        </div>
        {customPlatforms.length ? (
          <ul className="custom-platform-list">
            {customPlatforms.map((platform) => (
              <li key={platform.id}>
                <div>
                  <strong>{platform.name}</strong>
                  <p>{platform.positioning}</p>
                </div>
                <small>
                  {platform.requiredAsset === "none"
                    ? "无必需素材"
                    : platform.requiredAsset === "cover"
                      ? "需要封面"
                      : "需要视频"}
                </small>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => removeCustomPlatform(platform.id)}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      ) : null}

      <section className="bottom-panel" aria-label="发布闭环">
        <div className="flow" aria-labelledby="flow-title">
          <h2 id="flow-title">MVP 流程</h2>
          <ol>
            {workflowSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="ops-panel" aria-labelledby="ops-title">
          <div className="history-heading">
            <div>
              <span className="section-label">发布编排</span>
              <h2 id="ops-title">平台任务状态</h2>
            </div>
            <p>
              就绪 {readyCount} / 草稿候选 {draftCandidateCount} / 阻塞{" "}
              {blockedCount}
            </p>
          </div>
          {publishPlan.length ? (
            <ul>
              {publishPlan.map((item) => (
                <li key={item.platformId}>
                  <div>
                    <strong>{item.platformName}</strong>
                    <p>{item.nextAction}</p>
                    <small>预计处理 {item.etaSeconds}s</small>
                  </div>
                  <span className={`ops-status ${item.progressTone}`}>
                    {item.progress ?? statusLabel[item.status]}
                  </span>
                  <small>{item.score} 分</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>选择目标平台后，这里会生成发布任务队列和下一步动作。</p>
          )}
        </div>

        <div className="history-panel" aria-labelledby="history-title">
          <div className="history-heading">
            <div>
              <span className="section-label">发布批次</span>
              <h2 id="history-title">模拟发布记录</h2>
            </div>
            {latestSummary ? (
              <p>
                成功 {latestSummary.success} / 草稿 {latestSummary.draft} / 失败{" "}
                {latestSummary.failed} /{" "}
                {latestBatch?.deliveryMode === "webhook" ? "Webhook" : "本地"} / 用时{" "}
                {formatDuration(latestBatch?.durationMs)}
              </p>
            ) : null}
          </div>
          {publishHistory.length ? (
            <ul>
              {publishHistory.map((result) => (
                <li key={result.id}>
                  <div>
                    <strong>{getPlatformName(result.platformId)}</strong>
                    <p>{result.message}</p>
                    {result.url ? <small>{result.url}</small> : null}
                  </div>
                  <span className={`publish-status ${result.status}`}>
                    {result.status}
                  </span>
                  <small>
                    {result.score} 分 · {formatTime(result.createdAt)}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>载入示例内容后点击模拟发布，这里会保留最近 12 条发布结果。</p>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;

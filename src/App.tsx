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

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">ContentBridge MVP</p>
          <h1 id="product-title">创作者多平台发布控制台</h1>
          <p className="lead">
            一份内容生成 6 个平台版本，自动做发布体检，并用模拟发布跑完整闭环。
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
              <option value="webhook">Webhook 实发</option>
            </select>
          </label>
          {deliveryMode === "webhook" ? (
            <label>
              Webhook URL
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
                ? "真实投递到 Webhook"
                : "模拟一键发布"}
          </button>
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

      <section className="workspace" aria-label="工作台概览">
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

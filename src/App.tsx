import { useEffect, useState } from "react";
import { ContentEditor } from "./components/ContentEditor";
import { PlatformPreviewGrid } from "./components/PlatformPreviewGrid";
import { getPlatformAdapter } from "./adapters/registry";
import { emptyContentInput, sampleContentInput } from "./data/sampleContent";
import { adaptContentForSelectedPlatforms } from "./services/adaptContent";
import type { AdaptedContent, ContentInput, PublishResult } from "./types/content";
import type { PlatformPreview } from "./services/adaptContent";

interface PublishBatch {
  id: string;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
  results: PublishResult[];
}

const storageKey = "contentbridge-draft-v2";

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
    };
  } catch {
    return null;
  }
};

function App() {
  const storedDraft = readStoredDraft();
  const [content, setContent] = useState<ContentInput>(
    storedDraft?.content ?? emptyContentInput,
  );
  const [publishBatches, setPublishBatches] = useState<PublishBatch[]>(
    storedDraft?.publishBatches ?? [],
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<Record<string, string>>({});
  const [editedContent, setEditedContent] = useState<Record<string, AdaptedContent>>(
    storedDraft?.editedContent ?? {},
  );
  const generatedPreviews = adaptContentForSelectedPlatforms(content);
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
      const result = await preview.adapter.publish(
        preview.adapted,
        preview.validation,
      );
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
      results,
    };
    setPublishBatches((current) => [batch, ...current].slice(0, 8));
    setIsPublishing(false);
    window.setTimeout(() => setPublishProgress({}), 1600);
  };

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ content, editedContent, publishBatches }),
    );
  }, [content, editedContent, publishBatches]);

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

  const getPlatformName = (platformId: string) =>
    getPlatformAdapter(platformId)?.name ?? platformId;

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
        <button
          type="button"
          className="publish-button"
          disabled={!hasContent || !previews.length || isPublishing}
          onClick={publishAll}
        >
          {isPublishing ? "发布中..." : "模拟一键发布"}
        </button>
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
                {latestSummary.failed} / 用时 {formatDuration(latestBatch?.durationMs)}
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

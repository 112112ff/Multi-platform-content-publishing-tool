import { useEffect, useMemo, useState } from "react";
import type { AdaptedContent } from "../types/content";
import type { PlatformPreview } from "../services/adaptContent";

interface PlatformPreviewGridProps {
  previews: PlatformPreview[];
  hasContent: boolean;
  onUpdateContent: (
    platformId: string,
    patch: Partial<AdaptedContent>,
  ) => void;
  onResetContent: (platformId: string) => void;
  editedPlatformIds: string[];
}

const tagsToText = (tags: string[]) => tags.join("，");

const textToTags = (value: string) =>
  value
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

const scoreLevel = (score: number) => {
  if (score >= 88) {
    return "good";
  }
  if (score >= 75) {
    return "medium";
  }
  return "risk";
};

export function PlatformPreviewGrid({
  previews,
  hasContent,
  onUpdateContent,
  onResetContent,
  editedPlatformIds,
}: PlatformPreviewGridProps) {
  const [activePlatformId, setActivePlatformId] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    if (!previews.length) {
      setActivePlatformId("");
      return;
    }

    if (!previews.some((preview) => preview.adapted.platformId === activePlatformId)) {
      setActivePlatformId(previews[0].adapted.platformId);
    }
  }, [activePlatformId, previews]);

  const activePreview = useMemo(
    () =>
      previews.find((preview) => preview.adapted.platformId === activePlatformId) ??
      previews[0],
    [activePlatformId, previews],
  );
  const isActiveEdited = editedPlatformIds.includes(activePreview?.adapted.platformId);

  const exportMarkdown = async () => {
    if (!activePreview || !hasContent) {
      return;
    }

    const markdown = [
      `# ${activePreview.adapted.title}`,
      "",
      activePreview.adapted.body,
      "",
      activePreview.adapted.tags.map((tag) => `#${tag}`).join(" "),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(markdown);
      setCopyStatus("已复制 Markdown");
    } catch {
      setCopyStatus("复制失败，可手动选中正文");
    }

    window.setTimeout(() => setCopyStatus(""), 1800);
  };

  const exportAllMarkdown = async () => {
    if (!hasContent) {
      return;
    }

    const markdown = previews
      .map((preview) =>
        [
          `# ${preview.platformName}`,
          "",
          `## ${preview.adapted.title}`,
          "",
          preview.adapted.body,
          "",
          preview.adapted.tags.map((tag) => `#${tag}`).join(" "),
        ].join("\n"),
      )
      .join("\n\n---\n\n");

    try {
      await navigator.clipboard.writeText(markdown);
      setCopyStatus("已复制全部平台 Markdown");
    } catch {
      setCopyStatus("复制失败，可手动选中内容");
    }

    window.setTimeout(() => setCopyStatus(""), 1800);
  };

  if (!previews.length) {
    return (
      <section className="empty-preview" aria-label="平台预览">
        <h2>请选择目标平台</h2>
        <p>至少选择一个平台后，系统会在这里展示适配预览。</p>
      </section>
    );
  }

  return (
    <section className="publish-workbench" aria-label="平台适配工作台">
      <header className="workbench-header">
        <div>
          <span className="section-label">平台适配</span>
          <h2>发布队列</h2>
        </div>
        <p>{previews.length} 个平台已接入统一适配器</p>
      </header>

      <div className="workbench-body">
        <nav className="platform-rail" aria-label="平台列表">
          {previews.map((preview) => {
            const isActive = preview.adapted.platformId === activePreview.adapted.platformId;
            const isEdited = editedPlatformIds.includes(preview.adapted.platformId);
            return (
              <button
                className={isActive ? "platform-row active" : "platform-row"}
                key={preview.adapted.platformId}
                type="button"
                onClick={() => setActivePlatformId(preview.adapted.platformId)}
              >
                <span>
                  <b>{preview.platformName}</b>
                  <small>{isEdited ? "已人工编辑" : preview.tone}</small>
                </span>
                <strong className={`score-pill ${scoreLevel(preview.validation.score)}`}>
                  {hasContent ? preview.validation.score : "--"}
                </strong>
              </button>
            );
          })}
        </nav>

        <article className="platform-editor">
          <div className="platform-editor-title">
            <div>
              <span className="section-label">{activePreview.platformName}</span>
              <h2>{hasContent ? activePreview.adapted.title : "待生成平台版本"}</h2>
            </div>
            <div className="editor-tools">
              <div className="segmented-control" aria-label="编辑模式">
                <button
                  className={mode === "edit" ? "active" : ""}
                  type="button"
                  onClick={() => setMode("edit")}
                >
                  编辑
                </button>
                <button
                  className={mode === "preview" ? "active" : ""}
                  type="button"
                  onClick={() => setMode("preview")}
                >
                  预览
                </button>
              </div>
              <button type="button" disabled={!hasContent} onClick={exportMarkdown}>
                复制当前
              </button>
              <button type="button" disabled={!hasContent} onClick={exportAllMarkdown}>
                导出全部
              </button>
              <button
                type="button"
                disabled={!hasContent || !isActiveEdited}
                onClick={() => onResetContent(activePreview.adapted.platformId)}
              >
                恢复生成
              </button>
              <strong className={`score-pill large ${scoreLevel(activePreview.validation.score)}`}>
                {hasContent ? activePreview.validation.score : "--"}
              </strong>
            </div>
          </div>
          {copyStatus ? <p className="copy-status">{copyStatus}</p> : null}

          {hasContent && mode === "edit" ? (
            <div className="platform-form">
              <label>
                平台标题
                <input
                  value={activePreview.adapted.title}
                  onChange={(event) =>
                    onUpdateContent(activePreview.adapted.platformId, {
                      title: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                平台正文
                <textarea
                  value={activePreview.adapted.body}
                  rows={12}
                  onChange={(event) =>
                    onUpdateContent(activePreview.adapted.platformId, {
                      body: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                平台标签
                <input
                  value={tagsToText(activePreview.adapted.tags)}
                  onChange={(event) =>
                    onUpdateContent(activePreview.adapted.platformId, {
                      tags: textToTags(event.target.value),
                    })
                  }
                />
              </label>
            </div>
          ) : hasContent ? (
            <div className="platform-live-preview">
              <h3>{activePreview.adapted.title}</h3>
              <div className="preview-body">
                {activePreview.adapted.body.split(/\n+/).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="tag-row">
                {activePreview.adapted.tags.map((tag) => (
                  <span key={`preview-${activePreview.adapted.platformId}-${tag}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>输入内容或载入示例后，这里会生成当前平台的标题、正文和标签。</p>
            </div>
          )}
        </article>

        <aside className="insight-panel">
          <section>
            <span className="section-label">发布体检</span>
            <h2>
              {activePreview.validation.canPublish ? "可进入模拟发布" : "需要处理阻塞项"}
            </h2>
            {activePreview.validation.issues.length ? (
              <ul className="issue-list">
                {activePreview.validation.issues.map((issue) => (
                  <li key={`${issue.level}-${issue.message}`}>
                    <b>{issue.level}</b>
                    <span>{issue.message}</span>
                    {issue.suggestion ? <small>{issue.suggestion}</small> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>未发现明显发布风险。</p>
            )}
          </section>

          <section>
            <span className="section-label">平台策略</span>
            <h2>{activePreview.positioning}</h2>
            <p>{activePreview.contentStrategy}</p>
            <ul className="strategy-notes">
              {activePreview.adapted.strategyNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>

          <section>
            <span className="section-label">摘要</span>
            <p>{activePreview.adapted.summary}</p>
            <div className="tag-row">
              {activePreview.adapted.tags.map((tag) => (
                <span key={`${activePreview.adapted.platformId}-${tag}`}>{tag}</span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

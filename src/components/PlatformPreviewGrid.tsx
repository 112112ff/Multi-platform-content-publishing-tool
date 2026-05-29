import type { PlatformPreview } from "../services/adaptContent";

interface PlatformPreviewGridProps {
  previews: PlatformPreview[];
  hasContent: boolean;
}

export function PlatformPreviewGrid({
  previews,
  hasContent,
}: PlatformPreviewGridProps) {
  if (!previews.length) {
    return (
      <section className="empty-preview" aria-label="平台预览">
        <h2>请选择目标平台</h2>
        <p>至少选择一个平台后，系统会在这里展示适配预览。</p>
      </section>
    );
  }

  return (
    <div className="platform-grid" aria-label="平台适配预览">
      {previews.map((preview) => (
        <article className="platform-card" key={preview.adapted.platformId}>
          <div className="platform-card-header">
            <span>{preview.platformName}</span>
            <small>{preview.tone}</small>
          </div>
          <strong>{hasContent ? preview.adapted.title : "待生成"}</strong>
          <p>{preview.positioning}</p>
          <div className="strategy-box">
            <b>内容策略</b>
            <p>{preview.contentStrategy}</p>
          </div>
          {hasContent ? (
            <>
              <p className="preview-summary">{preview.adapted.summary}</p>
              <div className="tag-row">
                {preview.adapted.tags.map((tag) => (
                  <span key={`${preview.adapted.platformId}-${tag}`}>{tag}</span>
                ))}
              </div>
              <ul className="strategy-notes">
                {preview.adapted.strategyNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>输入内容后会展示平台版本、标签和适配说明。</p>
          )}
        </article>
      ))}
    </div>
  );
}

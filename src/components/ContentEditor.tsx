import type { ContentInput } from "../types/content";

interface ContentEditorProps {
  content: ContentInput;
  platformOptions: { id: string; name: string }[];
  onChange: (content: ContentInput) => void;
  onLoadSample: () => void;
  onReset: () => void;
}

const tagsToText = (tags: string[]) => tags.join("，");

const textToTags = (value: string) =>
  value
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

export function ContentEditor({
  content,
  platformOptions,
  onChange,
  onLoadSample,
  onReset,
}: ContentEditorProps) {
  const updateContent = (patch: Partial<ContentInput>) => {
    onChange({ ...content, ...patch });
  };

  const togglePlatform = (platformId: string) => {
    const selected = content.selectedPlatformIds.includes(platformId)
      ? content.selectedPlatformIds.filter((id) => id !== platformId)
      : [...content.selectedPlatformIds, platformId];

    updateContent({ selectedPlatformIds: selected });
  };

  return (
    <form className="content-editor" aria-label="原始内容输入">
      <div className="editor-actions">
        <span className="section-label">原始内容</span>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={onReset}>
            清空
          </button>
          <button type="button" onClick={onLoadSample}>
            载入示例内容
          </button>
        </div>
      </div>

      <label>
        标题
        <input
          value={content.title}
          onChange={(event) => updateContent({ title: event.target.value })}
          placeholder="输入要发布的内容标题"
        />
      </label>

      <label>
        正文
        <textarea
          value={content.body}
          onChange={(event) => updateContent({ body: event.target.value })}
          placeholder="输入原始正文，后续会适配成不同平台版本"
          rows={10}
        />
      </label>

      <label>
        标签
        <input
          value={tagsToText(content.tags)}
          onChange={(event) =>
            updateContent({ tags: textToTags(event.target.value) })
          }
          placeholder="用逗号分隔，例如：AI学习，效率工具"
        />
      </label>

      <div className="field-grid">
        <label>
          封面图 URL
          <input
            value={content.coverUrl ?? ""}
            onChange={(event) =>
              updateContent({ coverUrl: event.target.value })
            }
            placeholder="用于公众号、小红书等平台预览"
          />
        </label>
        <label>
          视频链接
          <input
            value={content.videoUrl ?? ""}
            onChange={(event) =>
              updateContent({ videoUrl: event.target.value })
            }
            placeholder="用于 B站发布校验"
          />
        </label>
      </div>

      <div className="asset-preview" aria-label="素材预览">
        <div>
          <span className="section-label">封面</span>
          {content.coverUrl ? (
            <img src={content.coverUrl} alt="封面图预览" />
          ) : (
            <p>未配置封面图</p>
          )}
        </div>
        <div>
          <span className="section-label">视频素材</span>
          <p>{content.videoUrl ? "已配置视频链接" : "未配置视频链接"}</p>
        </div>
      </div>

      <fieldset>
        <legend>目标平台</legend>
        <div className="platform-toggle-grid">
          {platformOptions.map((platform) => (
            <label className="platform-toggle" key={platform.id}>
              <input
                type="checkbox"
                checked={content.selectedPlatformIds.includes(platform.id)}
                onChange={() => togglePlatform(platform.id)}
              />
              {platform.name}
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  );
}

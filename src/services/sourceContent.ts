import type { ContentInput } from "../types/content";

const emptyParsedContent = (selectedPlatformIds: string[] = []): ContentInput => ({
  title: "",
  body: "",
  tags: [],
  coverUrl: "",
  videoUrl: "",
  selectedPlatformIds,
});

const cleanTag = (tag: string) =>
  tag
    .replace(/^#+/, "")
    .replace(/[，。,.；;、:：\s]+$/g, "")
    .trim();

const uniqueTags = (tags: string[]) => {
  const seen = new Set<string>();

  return tags
    .map(cleanTag)
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 8);
};

const extractTags = (source: string) => {
  const tags: string[] = [];

  for (const match of source.matchAll(/#([^\s#，。,.；;、]+)/g)) {
    tags.push(match[1]);
  }

  for (const match of source.matchAll(/(?:^|\n)\s*(?:标签|Tags?)[:：]\s*([^\n]+)/gi)) {
    tags.push(...match[1].split(/[#，,、\s]+/));
  }

  return uniqueTags(tags);
};

const isTagOnlyLine = (line: string) =>
  /^(?:标签|Tags?)[:：]/i.test(line.trim()) ||
  /^(?:#[^\s#，。,.；;、]+)(?:\s+#[^\s#，。,.；;、]+)*$/.test(line.trim());

const normalizeTitle = (line: string) =>
  line
    .replace(/^#+\s*/, "")
    .replace(/^标题[:：]\s*/, "")
    .trim()
    .slice(0, 80);

export function parseSourceContentToInput(
  sourceText: string,
  selectedPlatformIds: string[] = [],
): ContentInput {
  const source = sourceText.replace(/\r\n/g, "\n").trim();

  if (!source) {
    return emptyParsedContent(selectedPlatformIds);
  }

  const lines = source.split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim() && !isTagOnlyLine(line));
  const firstLine = firstContentIndex >= 0 ? lines[firstContentIndex].trim() : "";
  const hasExplicitTitle = /^#+\s+/.test(firstLine) || /^标题[:：]/.test(firstLine);
  const nextContentLine = lines.slice(firstContentIndex + 1).find((line) => line.trim());
  const shouldUseFirstLineAsTitle =
    hasExplicitTitle || (Boolean(nextContentLine) && firstLine.length <= 42);
  const title = shouldUseFirstLineAsTitle
    ? normalizeTitle(firstLine)
    : normalizeTitle(firstLine.split(/[。.!！？?]/)[0] || firstLine);
  const bodyLines = lines.filter((line, index) => {
    if (index === firstContentIndex && shouldUseFirstLineAsTitle) {
      return false;
    }

    return !isTagOnlyLine(line);
  });
  const body = bodyLines.join("\n").trim() || source;
  const tags = extractTags(source);

  return {
    title,
    body,
    tags:
      tags.length > 0
        ? tags
        : uniqueTags([
            title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").slice(0, 12),
            "内容改写",
          ]),
    coverUrl: "",
    videoUrl: "",
    selectedPlatformIds,
  };
}

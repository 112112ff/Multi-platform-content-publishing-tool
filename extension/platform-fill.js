const platformMatchers = [
  ["wechat", /mp\.weixin\.qq\.com/],
  ["zhihu", /(zhihu\.com|zhuanlan\.zhihu\.com)/],
  ["bilibili", /member\.bilibili\.com/],
  ["xiaohongshu", /creator\.xiaohongshu\.com/],
  ["douyin", /creator\.douyin\.com/],
  ["weibo", /weibo\.com/],
];

const platformId = platformMatchers.find(([, pattern]) => pattern.test(location.hostname))?.[0];

function setNativeValue(element, value) {
  if (!element) {
    return false;
  }

  element.focus();

  if ("value" in element) {
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  element.textContent = value;
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  return true;
}

function findTitleTarget() {
  return (
    document.querySelector('input[placeholder*="标题"]') ||
    document.querySelector('textarea[placeholder*="标题"]') ||
    document.querySelector('input[name*="title" i]') ||
    document.querySelector('[contenteditable="true"]')
  );
}

function findBodyTarget() {
  const candidates = [
    ...document.querySelectorAll("textarea"),
    ...document.querySelectorAll('[contenteditable="true"]'),
  ];

  return candidates.find((item) => item !== findTitleTarget()) ?? candidates[0];
}

function mountBridgePanel(draft, fillResult) {
  const existing = document.getElementById("contentbridge-extension-panel");
  if (existing) {
    existing.remove();
  }

  const panel = document.createElement("aside");
  panel.id = "contentbridge-extension-panel";
  panel.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:2147483647",
    "width:320px",
    "max-height:420px",
    "overflow:auto",
    "background:#fff",
    "border:1px solid #cbd6da",
    "border-radius:10px",
    "box-shadow:0 18px 48px rgba(0,0,0,.18)",
    "font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
    "color:#172026",
    "padding:12px",
  ].join(";");

  const title = document.createElement("strong");
  title.style.cssText = "display:block;margin-bottom:6px;";
  title.textContent = "ContentBridge 发布草稿";

  const description = document.createElement("p");
  description.style.cssText = "margin:0 0 8px;color:#53666b;";
  description.textContent = `已接收 ${draft.platformName ?? draft.platformId} 任务。${
    fillResult ? "已尝试填充页面。" : "当前页面未找到稳定输入框，请手动复制。"
  }`;

  const titleLabel = document.createElement("label");
  titleLabel.style.cssText = "display:block;font-weight:700;";
  titleLabel.textContent = "标题";

  const titleText = document.createElement("textarea");
  titleText.readOnly = true;
  titleText.style.cssText = "width:100%;height:54px;margin:4px 0 8px;";
  titleText.value = draft.title ?? "";

  const bodyLabel = document.createElement("label");
  bodyLabel.style.cssText = "display:block;font-weight:700;";
  bodyLabel.textContent = "正文";

  const bodyText = document.createElement("textarea");
  bodyText.readOnly = true;
  bodyText.style.cssText = "width:100%;height:120px;margin:4px 0 8px;";
  bodyText.value = draft.body ?? "";

  const note = document.createElement("small");
  note.style.cssText = "color:#60747a;";
  note.textContent = "最终发布前请人工确认平台规则、素材和账号状态。";

  panel.append(title, description, titleLabel, titleText, bodyLabel, bodyText, note);

  document.body.appendChild(panel);
}

async function loadAndFillDraft() {
  if (!platformId) {
    return;
  }

  const draftKey = `draft:${platformId}`;
  const stored = await chrome.storage.local.get(draftKey);
  const draft = stored[draftKey];
  if (!draft) {
    return;
  }

  const fill = () => {
    const titleFilled = setNativeValue(findTitleTarget(), draft.title ?? "");
    const bodyFilled = setNativeValue(findBodyTarget(), [draft.body, (draft.tags ?? []).map((tag) => `#${tag}`).join(" ")].filter(Boolean).join("\n\n"));
    mountBridgePanel(draft, titleFilled || bodyFilled);
  };

  fill();
  window.setTimeout(fill, 1200);
  window.setTimeout(fill, 3000);
}

loadAndFillDraft();

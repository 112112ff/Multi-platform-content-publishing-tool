const creatorUrls = {
  wechat: "https://mp.weixin.qq.com/",
  zhihu: "https://zhuanlan.zhihu.com/write",
  bilibili: "https://member.bilibili.com/platform/upload/video/frame",
  xiaohongshu: "https://creator.xiaohongshu.com/publish/publish",
  weibo: "https://weibo.com/",
  douyin: "https://creator.douyin.com/creator-micro/content/publish",
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CONTENTBRIDGE_EXTENSION_PING") {
    sendResponse({ ok: true, version: "0.1.0" });
    return true;
  }

  if (message?.type !== "CONTENTBRIDGE_PUBLISH_JOBS") {
    return false;
  }

  const jobs = Array.isArray(message.jobs) ? message.jobs : [];
  const createdAt = new Date().toISOString();

  Promise.all(
    jobs.map(async (job) => {
      const draftKey = `draft:${job.platformId}`;
      await chrome.storage.local.set({
        [draftKey]: {
          ...job,
          receivedAt: createdAt,
        },
      });

      const url = creatorUrls[job.platformId] ?? "https://www.google.com/search?q=creator+studio";
      await chrome.tabs.create({ active: false, url });

      return {
        platformId: job.platformId,
        ok: true,
        route: "browser-extension",
        url,
      };
    }),
  )
    .then((results) => sendResponse({ ok: true, results }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown extension error",
      }),
    );

  return true;
});

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  accountChannels,
  buildHotTopicSuggestions,
  getPlatformById,
  platformCatalog,
  type AgentConversationMessage,
  type AgentPreferences,
  type ProductPlatformId,
} from "./services/agentPlanner";
import { buildAgentOperationPlan, type PublishJob } from "./integrations/matrixOperationEngine";
import { adaptContentForSelectedPlatforms, type PlatformPreview } from "./services/adaptContent";
import {
  buildAgentPlanWithMiniMax,
  checkMiniMaxAgentStatus,
  type MiniMaxAgentStatus,
} from "./services/minimaxAgent";
import { sendJobsToExtensionBridge } from "./services/extensionBridge";
import { deliverPreviewToReceiver } from "./services/realDelivery";
import type { AdaptedContent, ContentInput } from "./types/content";
import type { ConnectedAccount, DeliveryResult } from "./types/delivery";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type FlowStep = "idle" | "account" | "publish" | "done";

const defaultPlatformIds = platformCatalog.map((platform) => platform.id);

const emptyContent: ContentInput = {
  title: "",
  body: "",
  tags: [],
  coverUrl: "",
  videoUrl: "",
  selectedPlatformIds: [],
};

const quickPrompts = [
  "帮我写一篇小红书笔记，主题是 AI 工具提升学习效率",
  "写一篇公众号长文章，主题是字节跳动公司的产品增长方法",
  "做一个抖音口播脚本，讲多平台内容发布怎么省时间",
];

const lengthLabels: Record<AgentPreferences["length"], string> = {
  short: "短内容",
  medium: "标准",
  long: "长文章",
};

const styleLabels: Record<AgentPreferences["style"], string> = {
  practical: "实用清单",
  professional: "专业分析",
  story: "真实故事",
  viral: "传播感",
};

const hotnessLabels: Record<AgentPreferences["hotness"], string> = {
  stable: "稳妥常青",
  trend: "结合热点",
};

const createMessage = (role: ChatMessage["role"], text: string): ChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  text,
});

const createAccountState = (): ConnectedAccount[] =>
  platformCatalog.map((platform) => {
    const channel = accountChannels.find((item) => item.platformId === platform.id);

    if (!channel) {
      throw new Error(`missing account channel: ${platform.id}`);
    }

    return {
      ...channel,
      status: "disconnected",
      loginUrl: platform.loginUrl,
      loginLabel: platform.loginLabel,
    };
  });

const scoreTone = (score: number) => {
  if (score >= 88) {
    return "good";
  }

  if (score >= 72) {
    return "medium";
  }

  return "risk";
};

const resultText: Record<DeliveryResult["status"], string> = {
  success: "已完成",
  failed: "失败",
  blocked: "被阻止",
};

const buildDraftText = (preview: PlatformPreview) =>
  [
    preview.adapted.title,
    "",
    preview.adapted.body,
    "",
    preview.adapted.tags.map((tag) => `#${tag}`).join(" "),
  ].join("\n");

function App() {
  const [content, setContent] = useState<ContentInput>(emptyContent);
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      "assistant",
      "告诉我你想发什么、希望发到哪个平台。我会帮你判断目标平台，生成草稿，再带你确认账号并发布。",
    ),
  ]);
  const [agentInput, setAgentInput] = useState("");
  const [flowStep, setFlowStep] = useState<FlowStep>("idle");
  const [activePlatformId, setActivePlatformId] =
    useState<ProductPlatformId>("xiaohongshu");
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(createAccountState);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [receiverUrl, setReceiverUrl] = useState("");
  const [showTestReceiver, setShowTestReceiver] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [agentStatus, setAgentStatus] = useState<MiniMaxAgentStatus>({
    mode: "proxy-missing",
    message: "正在检测发布助理...",
  });
  const [preferences, setPreferences] = useState<AgentPreferences>({
    length: "medium",
    style: "practical",
    hotness: "trend",
  });
  const [publishResults, setPublishResults] = useState<DeliveryResult[]>([]);
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, AdaptedContent>>({});

  const activePlatform = getPlatformById(activePlatformId);
  const activeAccount = accounts.find((account) => account.platformId === activePlatformId);
  const previews = useMemo(() => adaptContentForSelectedPlatforms(content), [content]);
  const activePreview =
    previews.find((preview) => preview.adapted.platformId === activePlatformId) ?? previews[0];
  const cleanPreview = useMemo<PlatformPreview | undefined>(() => {
    if (!activePreview) {
      return undefined;
    }

    const adapted = previewOverrides[activePlatformId] ?? activePreview.adapted;

    return {
      ...activePreview,
      platformName: activePlatform.name,
      contentStrategy: activePlatform.promise,
      tone: activePlatform.persona,
      adapted,
    };
  }, [activePlatform, activePlatformId, activePreview, previewOverrides]);
  const operationPlan = useMemo(() => {
    if (!content.selectedPlatformIds.length) {
      return null;
    }

    return buildAgentOperationPlan(content, accountChannels);
  }, [content]);
  const activeJob = operationPlan?.publishJobs.find(
    (job) => job.platformId === activePlatformId,
  );
  const displayIssues = useMemo(() => {
    const issues: Array<{ level: string; message: string }> = [];

    if (!cleanPreview) {
      return issues;
    }

    if (cleanPreview.adapted.title.length > 36) {
      issues.push({ level: "建议", message: "标题偏长，可以压缩成更明确的一句话。" });
    }

    if (
      (activePlatformId === "douyin" || activePlatformId === "bilibili") &&
      !content.videoUrl
    ) {
      issues.push({ level: "提醒", message: "视频平台正式发布前需要补充视频素材。" });
    }

    if (
      (activePlatformId === "xiaohongshu" || activePlatformId === "wechat") &&
      !content.coverUrl
    ) {
      issues.push({ level: "提醒", message: "图文平台建议补充封面图，发布效果会更完整。" });
    }

    return issues;
  }, [activePlatformId, cleanPreview, content.coverUrl, content.videoUrl]);
  const accountConnected = activeAccount?.status === "connected";
  const hotSuggestions = useMemo(
    () => buildHotTopicSuggestions(content.title || "内容创作", activePlatform, preferences),
    [activePlatform, content.title, preferences],
  );

  useEffect(() => {
    let cancelled = false;

    void checkMiniMaxAgentStatus().then((status) => {
      if (!cancelled) {
        setAgentStatus(status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const pushMessages = (...newMessages: ChatMessage[]) => {
    setMessages((current) => [...current, ...newMessages]);
  };

  const applyAgentPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();

    if (!trimmed || isAgentThinking) {
      return;
    }

    setAgentInput("");
    setIsAgentThinking(true);
    const userMessage = createMessage("user", trimmed);
    const thinkingMessage = createMessage(
      "assistant",
      "我会结合前面的交流、发布偏好和热点方向，更新右侧预览。",
    );
    const conversationForPlan: AgentConversationMessage[] = [
      ...messages.map((message) => ({ role: message.role, text: message.text })),
      { role: userMessage.role, text: userMessage.text },
    ];

    pushMessages(userMessage, thinkingMessage);

    const plan = await buildAgentPlanWithMiniMax(
      trimmed,
      content,
      conversationForPlan,
      preferences,
    );
    const platformId = plan.platform.id;

    if (plan.source !== "minimax") {
      setAgentStatus({
        mode: "key-missing",
        message: "智能生成暂不可用，已自动切换离线规则，仍可继续生成草稿和发布。",
      });
    }

    setActivePlatformId(platformId);
    setContent({
      ...plan.content,
      selectedPlatformIds: defaultPlatformIds,
    });
    setPreviewOverrides({});
    setPublishResults([]);
    setFlowStep("publish");
    setAccountModalOpen(false);
    setIsAgentThinking(false);
    pushMessages(
      createMessage("assistant", plan.reply),
      createMessage(
        "assistant",
        `${plan.source === "minimax" ? "发布助理已生成草稿" : "已使用离线发布规则生成草稿"}。右侧已经生成多平台发布包，你可以逐个平台检查标题、正文和标签，再一键生成发布队列。`,
      ),
    );
  };

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void applyAgentPrompt(agentInput);
  };

  const confirmAccount = () => {
    setAccounts((current) =>
      current.map((account) =>
        account.platformId === activePlatformId
          ? {
              ...account,
              status: "connected",
              connectedAt: new Date().toISOString(),
            }
          : account,
      ),
    );
    setAccountModalOpen(false);
    setFlowStep("publish");
    pushMessages(
      createMessage(
        "assistant",
        `${activePlatform.name} 账号已确认。现在可以点右侧的一键发布，把草稿送到平台创作页。`,
      ),
    );
  };

  const updateActivePreview = (patch: Partial<PlatformPreview["adapted"]>) => {
    if (!cleanPreview) {
      return;
    }

    setPreviewOverrides((current) => ({
      ...current,
      [activePlatformId]: {
        ...cleanPreview.adapted,
        ...patch,
        platformId: activePlatformId,
      },
    }));
  };

  const buildBridgeJobs = (): Array<{
    job: PublishJob;
    preview: PlatformPreview;
    accountName: string;
    platformName: string;
    createdAt: string;
  }> => {
    if (!activeJob || !cleanPreview || !activeAccount) {
      return [];
    }

    return [
      {
        job: activeJob,
        preview: cleanPreview,
        accountName: activeAccount.displayName,
        platformName: activePlatform.name,
        createdAt: new Date().toISOString(),
      },
    ];
  };

  const getPreviewForPlatform = (preview: PlatformPreview): PlatformPreview => {
    const platformId = preview.adapted.platformId;
    return {
      ...preview,
      adapted: previewOverrides[platformId] ?? preview.adapted,
    };
  };

  const openPlatformCreatorPage = async (): Promise<DeliveryResult | null> => {
    if (!cleanPreview || !activeAccount) {
      return null;
    }

    const draft = buildDraftText(cleanPreview);
    let copied = false;

    try {
      await navigator.clipboard.writeText(draft);
      copied = true;
    } catch {
      copied = false;
    }

    window.open(activePlatform.creatorUrl || activePlatform.loginUrl, "_blank", "noopener,noreferrer");

    return {
      id: `manual-${activePlatformId}-${Date.now()}`,
      platformId: activePlatformId,
      accountName: activeAccount.displayName,
      status: "success",
      executionRoute: "official-creator-page",
      message: copied
        ? `已打开 ${activePlatform.name} 官方创作页，并把草稿复制到剪贴板。请在官方页面粘贴后做最终确认发布。`
        : `已打开 ${activePlatform.name} 官方创作页。浏览器没有允许自动复制，请点击“复制草稿”后粘贴到官方页面确认发布。`,
      createdAt: new Date().toISOString(),
      receiverUrl: activePlatform.creatorUrl || activePlatform.loginUrl,
    };
  };

  const publishToPlatformDraft = async () => {
    if (!cleanPreview || !activeJob || !activeAccount) {
      return;
    }

    if (!accountConnected) {
      setAccountModalOpen(true);
      setFlowStep("account");
      pushMessages(
        createMessage(
          "assistant",
          `先确认 ${activePlatform.name} 已在浏览器登录，我再把草稿发送到平台创作页。`,
        ),
      );
      return;
    }

    setIsPublishing(true);
    const results = await sendJobsToExtensionBridge({
      jobs: buildBridgeJobs(),
      timeoutMs: 1600,
    });
    const hasExtensionSuccess = results.some((result) => result.status === "success");
    const fallbackResult = hasExtensionSuccess ? null : await openPlatformCreatorPage();
    const nextResults = fallbackResult ? [fallbackResult] : results;

    setPublishResults(nextResults);
    setIsPublishing(false);
    setFlowStep(nextResults.some((result) => result.status === "success") ? "done" : "publish");
    pushMessages(
      createMessage(
        "assistant",
        hasExtensionSuccess
          ? `已把 ${activePlatform.name} 草稿送到官方创作页。请在打开的页面里做最终确认。`
          : `已打开 ${activePlatform.name} 官方创作页，并在本页准备好草稿。最终发布仍由你在官方页面确认。`,
      ),
    );
  };

  const publishAllDrafts = async () => {
    if (!previews.length) {
      return;
    }

    setIsPublishing(true);

    const queuedResults: DeliveryResult[] = previews.map((preview) => {
      const platform = getPlatformById(preview.adapted.platformId);
      const account =
        accounts.find((item) => item.platformId === preview.adapted.platformId) ??
        activeAccount;

      return {
        id: `queue-${preview.adapted.platformId}-${Date.now()}`,
        platformId: preview.adapted.platformId,
        accountName: account?.displayName ?? platform.accountName,
        status: "success",
        executionRoute: "multi-platform-draft-queue",
        message: `${platform.name} 已生成平台化草稿，发布前可打开官方创作页做最终确认。`,
        createdAt: new Date().toISOString(),
        receiverUrl: platform.creatorUrl || platform.loginUrl,
      };
    });

    setPublishResults(queuedResults);
    setIsPublishing(false);
    setFlowStep("done");
    pushMessages(
      createMessage(
        "assistant",
        `已生成 ${queuedResults.length} 个平台的发布队列。你可以先检查右侧各平台版本，再逐个平台打开官方创作页确认发布。`,
      ),
    );
  };

  const publishToReceiver = async () => {
    if (!receiverUrl.trim() || !cleanPreview || !activeJob || !activeAccount) {
      return;
    }

    setIsPublishing(true);
    const result = await deliverPreviewToReceiver({
      receiverUrl: receiverUrl.trim(),
      job: activeJob,
      preview: cleanPreview,
      accountName: activeAccount.displayName,
      platformName: activePlatform.name,
      createdAt: new Date().toISOString(),
    });
    setPublishResults([result]);
    setIsPublishing(false);
    setFlowStep(result.status === "success" ? "done" : "publish");
  };

  const copyDraft = async () => {
    if (!cleanPreview) {
      return;
    }

    await navigator.clipboard.writeText(buildDraftText(cleanPreview));
    pushMessages(createMessage("assistant", "已复制当前平台草稿，可以手动粘贴到平台创作页。"));
  };

  const stepState = (step: FlowStep) => {
    const order: FlowStep[] = ["idle", "account", "publish", "done"];
    return order.indexOf(flowStep) >= order.indexOf(step) ? "active" : "";
  };

  return (
    <main className="consumer-shell">
      <section className="agent-home" aria-label="ContentBridge 多平台发布助理">
        <div className="brand-row">
          <div>
            <span>ContentBridge</span>
            <h1>输入一份内容，生成全平台发布包</h1>
          </div>
          <strong>{cleanPreview ? `${previews.length} 个平台已适配` : "多平台发布助理"}</strong>
        </div>

        <div className="agent-layout">
          <aside className="agent-conversation">
            <div className={`agent-runtime-status ${agentStatus.mode}`}>
              <b>
                {agentStatus.mode === "connected"
                  ? "发布助理已增强"
                  : agentStatus.mode === "key-missing"
                    ? "离线规则可用"
                    : "离线规则模式"}
              </b>
              <p>{agentStatus.message}</p>
            </div>

            <div className="agent-status">
              <span className={stepState("idle")}>输入内容</span>
              <span className={stepState("publish")}>平台适配</span>
              <span className={stepState("done")}>发布队列</span>
            </div>

            <div className="chat-stream" aria-live="polite">
              {messages.map((message) => (
                <article className={`chat-bubble ${message.role}`} key={message.id}>
                  <b>{message.role === "assistant" ? "发布助理" : "你"}</b>
                  <p>{message.text}</p>
                </article>
              ))}
            </div>

            <div className="quick-prompt-row">
              {quickPrompts.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  disabled={isAgentThinking}
                  onClick={() => void applyAgentPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="preference-panel" aria-label="发布偏好">
              <label>
                长度
                <select
                  value={preferences.length}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      length: event.target.value as AgentPreferences["length"],
                    }))
                  }
                >
                  {Object.entries(lengthLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                风格
                <select
                  value={preferences.style}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      style: event.target.value as AgentPreferences["style"],
                    }))
                  }
                >
                  {Object.entries(styleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                选题
                <select
                  value={preferences.hotness}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      hotness: event.target.value as AgentPreferences["hotness"],
                    }))
                  }
                >
                  {Object.entries(hotnessLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={isAgentThinking}
                onClick={() => void applyAgentPrompt("根据前面的全部交流和当前发布偏好，重新生成右侧预览")}
              >
                用当前偏好更新预览
              </button>
            </div>

            <form className="agent-input-card" onSubmit={submitPrompt}>
              <textarea
                value={agentInput}
                onChange={(event) => setAgentInput(event.target.value)}
                placeholder="例如：帮我写一篇小红书笔记，主题是 AI 工具提升学习效率，语气真实一点"
                rows={4}
              />
              <button type="submit" disabled={isAgentThinking}>
                {isAgentThinking ? "生成中..." : "让发布助理生成流程"}
              </button>
            </form>
          </aside>

          <section className="publish-flow-panel" aria-label="多平台发布包">
            {!cleanPreview ? (
              <div className="empty-product-guide">
                <p>把一份原始内容交给发布助理，系统会自动生成公众号、知乎、B站、小红书、微博、抖音版本，并整理成发布队列。</p>
                <div className="guide-lanes">
                  {platformCatalog.map((platform) => (
                    <button
                      type="button"
                      key={platform.id}
                      disabled={isAgentThinking}
                      onClick={() =>
                        void applyAgentPrompt(`帮我生成${platform.name}内容，主题是 AI 工具提升学习效率`)
                      }
                    >
                      <b>{platform.name}</b>
                      <span>{platform.promise}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <header className="single-platform-header">
                  <div>
                    <span>多平台发布包</span>
                    <h2>{content.title}</h2>
                    <p>同一份内容已按平台语境自动改写，可逐个平台编辑和发布。</p>
                  </div>
                  <button type="button" onClick={publishAllDrafts}>
                    {isPublishing ? "生成中..." : "一键生成发布队列"}
                  </button>
                </header>

                <div className="platform-package-grid">
                  {previews.map((preview) => {
                    const platform = getPlatformById(preview.adapted.platformId);
                    const displayPreview = getPreviewForPlatform(preview);

                    return (
                      <button
                        type="button"
                        className={preview.adapted.platformId === activePlatformId ? "active" : ""}
                        key={preview.adapted.platformId}
                        onClick={() => setActivePlatformId(platform.id)}
                      >
                        <span>{platform.name}</span>
                        <strong>{displayPreview.adapted.title}</strong>
                        <small>{displayPreview.contentStrategy}</small>
                        <b className={scoreTone(displayPreview.validation.score)}>
                          {displayPreview.validation.score}
                        </b>
                      </button>
                    );
                  })}
                </div>

                <div className="hot-topic-card">
                  <div>
                    <span>{activePlatform.name} 热点推荐</span>
                    <strong>{hotnessLabels[preferences.hotness]} · {styleLabels[preferences.style]}</strong>
                  </div>
                  <ul>
                    {hotSuggestions.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                </div>

                <div className="draft-editor-card">
                  <div className="draft-editor-heading">
                    <div>
                      <span>正在编辑</span>
                      <h3>{activePlatform.name} 版本</h3>
                    </div>
                    <button type="button" onClick={() => setAccountModalOpen(true)}>
                      {accountConnected ? "账号已确认" : "确认账号"}
                    </button>
                  </div>
                  <label>
                    标题
                    <input
                      value={cleanPreview.adapted.title}
                      onChange={(event) => updateActivePreview({ title: event.target.value })}
                    />
                  </label>
                  <label>
                    正文
                    <textarea
                      value={cleanPreview.adapted.body}
                      rows={12}
                      onChange={(event) => updateActivePreview({ body: event.target.value })}
                    />
                  </label>
                  <label>
                    标签
                    <input
                      value={cleanPreview.adapted.tags.join("，")}
                      onChange={(event) =>
                        updateActivePreview({
                          tags: event.target.value
                            .split(/[,，\n]/)
                            .map((tag) => tag.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                </div>

                <div className="publish-action-card">
                  <div className={`score-card ${scoreTone(cleanPreview.validation.score)}`}>
                    <span>{cleanPreview.validation.score}</span>
                    <p>{cleanPreview.validation.canPublish ? "发布体检通过" : "需要修改后再发布"}</p>
                  </div>
                  {displayIssues.length ? (
                    <ul className="simple-issue-list">
                      {displayIssues.map((issue) => (
                        <li key={issue.message}>
                          <b>{issue.level}</b>
                          <span>{issue.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="clean-note">没有发现明显发布风险，可以进入发布。</p>
                  )}

                  <button
                    type="button"
                    className="primary-publish-button"
                    disabled={isPublishing || !cleanPreview.validation.canPublish}
                    onClick={publishToPlatformDraft}
                  >
                    {isPublishing ? "发布中..." : `一键发布到 ${activePlatform.name} 草稿`}
                  </button>
                  <button
                    type="button"
                    className="ghost-action"
                    disabled={isPublishing}
                    onClick={publishAllDrafts}
                  >
                    一键生成全部平台发布队列
                  </button>
                  <button type="button" className="ghost-action" onClick={copyDraft}>
                    复制草稿
                  </button>
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => setShowTestReceiver((value) => !value)}
                  >
                    {showTestReceiver ? "收起测试接收端" : "开发验证：测试接收端"}
                  </button>

                  {showTestReceiver ? (
                    <div className="receiver-box">
                      <p>这个入口只用于验证真实 HTTP POST，不是普通用户主流程。</p>
                      <input
                        value={receiverUrl}
                        onChange={(event) => setReceiverUrl(event.target.value)}
                        placeholder="https://webhook.site/... 或你的接收服务 URL"
                      />
                      <button
                        type="button"
                        disabled={isPublishing || !receiverUrl.trim()}
                        onClick={publishToReceiver}
                      >
                        发送到测试接收端
                      </button>
                    </div>
                  ) : null}

                  {publishResults.length ? (
                    <div className="result-stack">
                      {publishResults.map((result) => (
                        <article className={result.status} key={result.id}>
                          <strong>{resultText[result.status]}</strong>
                          <p>{result.message}</p>
                          <small>{result.receiverUrl ?? result.executionRoute}</small>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </div>
      </section>

      {accountModalOpen ? (
        <div className="account-modal-backdrop" onClick={() => setAccountModalOpen(false)}>
          <section
            className="consumer-account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-button"
              onClick={() => setAccountModalOpen(false)}
              aria-label="关闭账号确认"
            >
              ×
            </button>
            <span>只确认一个平台</span>
            <h3 id="account-modal-title">{activePlatform.name} 发布账号</h3>
            <p>
              这里不会收集账号密码。请用你自己的浏览器登录 {activePlatform.name}，确认后我们只把草稿送到平台创作页，最终发布由你人工确认。
            </p>

            <article className="single-account-card">
              <div>
                <b>{activeAccount?.displayName}</b>
                <small>{activeAccount?.persona}</small>
              </div>
              <strong>{accountConnected ? "已确认登录" : "待确认登录"}</strong>
            </article>

            <div className="modal-action-row">
              <a href={activePlatform.loginUrl} target="_blank" rel="noreferrer">
                {activePlatform.loginLabel}
              </a>
              <button type="button" onClick={confirmAccount}>
                我已登录，继续发布
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  accountChannels,
  getPlatformById,
  platformCatalog,
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
import type { ContentInput } from "./types/content";
import type { ConnectedAccount, DeliveryResult } from "./types/delivery";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type FlowStep = "idle" | "account" | "publish" | "done";

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
  "做一个抖音口播脚本，讲多平台内容发布怎么省时间",
  "写一篇知乎回答：创作者为什么不能直接复制同一份内容",
];

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
    message: "正在检测智能发布助理...",
  });
  const [publishResults, setPublishResults] = useState<DeliveryResult[]>([]);

  const activePlatform = getPlatformById(activePlatformId);
  const activeAccount = accounts.find((account) => account.platformId === activePlatformId);
  const previews = useMemo(() => adaptContentForSelectedPlatforms(content), [content]);
  const activePreview = previews[0];
  const cleanPreview = useMemo<PlatformPreview | undefined>(() => {
    if (!activePreview) {
      return undefined;
    }

    return {
      ...activePreview,
      platformName: activePlatform.name,
      contentStrategy: activePlatform.promise,
      tone: activePlatform.persona,
      adapted: {
        platformId: activePlatformId,
        title: content.title,
        body: content.body,
        summary: content.body.slice(0, 96),
        tags: content.tags,
        strategyNotes: [activePlatform.promise],
      },
    };
  }, [activePlatform, activePlatformId, activePreview, content]);
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
    pushMessages(
      createMessage("user", trimmed),
      createMessage("assistant", "我正在分析需求、选择平台并生成草稿。"),
    );

    const plan = await buildAgentPlanWithMiniMax(trimmed, content);
    const platformId = plan.platform.id;

    if (plan.source !== "minimax") {
      setAgentStatus({
        mode: "key-missing",
        message: "智能助理暂不可用，已自动切换离线规则。请检查本地密钥是否有效。",
      });
    }

    setActivePlatformId(platformId);
    setContent(plan.content);
    setPublishResults([]);
    setFlowStep("account");
    setAccountModalOpen(true);
    setIsAgentThinking(false);
    pushMessages(
      createMessage("assistant", plan.reply),
      createMessage(
        "assistant",
        `${plan.source === "minimax" ? "智能发布助理已生成草稿" : "已使用离线发布规则生成草稿"}。我只为你打开 ${plan.platform.name} 的账号确认，不会一次弹出六个平台。`,
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

    setContent((current) => ({
      ...current,
      title: patch.title ?? current.title,
      body: patch.body ?? current.body,
      tags: patch.tags ?? current.tags,
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
    setPublishResults(results);
    setIsPublishing(false);
    setFlowStep(results.some((result) => result.status === "success") ? "done" : "publish");
    pushMessages(
      createMessage(
        "assistant",
        results.some((result) => result.status === "success")
          ? `已把 ${activePlatform.name} 草稿发送给浏览器扩展。请在打开的官方创作页里做最终确认。`
          : "没有检测到可用的浏览器扩展。你可以先安装 extension 目录里的 Publisher Bridge，或用下方测试接收端验证真实投递。",
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

    await navigator.clipboard.writeText(
      [
        cleanPreview.adapted.title,
        "",
        cleanPreview.adapted.body,
        "",
        cleanPreview.adapted.tags.map((tag) => `#${tag}`).join(" "),
      ].join("\n"),
    );
    pushMessages(createMessage("assistant", "已复制当前平台草稿，可以手动粘贴到平台创作页。"));
  };

  const stepState = (step: FlowStep) => {
    const order: FlowStep[] = ["idle", "account", "publish", "done"];
    return order.indexOf(flowStep) >= order.indexOf(step) ? "active" : "";
  };

  return (
    <main className="consumer-shell">
      <section className="agent-home" aria-label="ContentBridge Agent">
        <div className="brand-row">
          <div>
            <span>ContentBridge</span>
            <h1>说一句话，智能发布助理帮你走完单平台发布流程</h1>
          </div>
          <strong>{cleanPreview ? activePlatform.name : "智能发布助理"}</strong>
        </div>

        <div className="agent-layout">
          <aside className="agent-conversation">
            <div className={`agent-runtime-status ${agentStatus.mode}`}>
              <b>
                {agentStatus.mode === "connected"
                  ? "智能助理已配置"
                  : agentStatus.mode === "key-missing"
                    ? "智能助理待配置"
                    : "离线规则模式"}
              </b>
              <p>{agentStatus.message}</p>
            </div>

            <div className="agent-status">
              <span className={stepState("idle")}>说出需求</span>
              <span className={stepState("account")}>确认账号</span>
              <span className={stepState("publish")}>一键发布</span>
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

            <form className="agent-input-card" onSubmit={submitPrompt}>
              <textarea
                value={agentInput}
                onChange={(event) => setAgentInput(event.target.value)}
                placeholder="例如：帮我写一篇小红书笔记，主题是 AI 工具提升学习效率，语气真实一点"
                rows={4}
              />
              <button type="submit" disabled={isAgentThinking}>
                {isAgentThinking ? "生成中..." : "让智能发布助理生成流程"}
              </button>
            </form>
          </aside>

          <section className="publish-flow-panel" aria-label="单平台发布流程">
            {!cleanPreview ? (
              <div className="empty-product-guide">
                <p>主流程保持很轻：输入一句话，系统会判断一个目标平台，生成草稿，再带你确认账号和发布。</p>
                <div className="guide-lanes">
                  {platformCatalog.slice(0, 4).map((platform) => (
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
                    <span>当前平台</span>
                    <h2>{activePlatform.name}</h2>
                    <p>{activePlatform.promise}</p>
                  </div>
                  <button type="button" onClick={() => setAccountModalOpen(true)}>
                    {accountConnected ? "账号已确认" : "确认账号"}
                  </button>
                </header>

                <div className="draft-editor-card">
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

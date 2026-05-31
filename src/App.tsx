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
  buildPlatformPackWithMiniMax,
  checkMiniMaxAgentStatus,
  type MiniMaxAgentStatus,
} from "./services/minimaxAgent";
import { parseSourceContentToInput } from "./services/sourceContent";
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
type InputMode = "draft" | "brief";

const defaultPlatformIds = platformCatalog.map((platform) => platform.id);

type PublishBrief = {
  topic: string;
  intent: string;
  audience: string;
  trendSignals: string;
};

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

const demoSourceText = [
  "AI 工具如何真正提升学习效率",
  "",
  "我最近发现，真正有用的 AI 工具不是替你偷懒，而是帮你把学习流程拆清楚。",
  "过去我复习一门课时，经常直接开始刷资料，结果越看越乱。后来我把流程拆成三步：先让 AI 帮我整理知识框架，再围绕薄弱点生成练习题，最后把错题交给 AI 做复盘总结。",
  "",
  "这个方法最适合三类人：准备考试的学生、需要快速学新技能的职场新人、以及要长期输出内容的创作者。它的关键不是让 AI 替你完成答案，而是让它帮你把问题变清楚、把练习变具体、把反馈变及时。",
  "",
  "我的真实建议是：不要一上来就问 AI 给我答案，而是问它三个问题：我现在应该先学什么？我哪里可能理解错？我下一步该怎么练？",
  "",
  "#AI工具 #学习效率 #学习方法 #自我提升",
].join("\n");

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

const extractTopic = (input: string) => {
  const topicMatch = input.match(/(?:主题是|主题为|关于|围绕)([^，。,.；;]+)/);

  if (topicMatch?.[1]) {
    return topicMatch[1].trim();
  }

  return input
    .replace(/帮我|请|写一篇|做一个|生成|发布|内容|文章|笔记|脚本/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 42);
};

const inferIntent = (input: string) => {
  if (/种草|推荐|安利|清单/.test(input)) {
    return "让读者快速理解价值，并愿意收藏或尝试";
  }

  if (/分析|观点|为什么|如何看待|长文章|深度/.test(input)) {
    return "用结构化分析讲清楚背景、判断和可执行结论";
  }

  if (/口播|视频|脚本|抖音|B站/.test(input)) {
    return "把核心观点改成适合视频表达的开头、节奏和行动引导";
  }

  return "把核心观点改成适合多平台分发的可读内容";
};

const inferAudience = (input: string) => {
  if (/学生|学习|效率/.test(input)) {
    return "学生、职场新人和希望提升效率的普通创作者";
  }

  if (/公司|商业|产品|增长|字节|互联网/.test(input)) {
    return "关注商业、产品增长和互联网公司的读者";
  }

  if (/创作者|发布|运营/.test(input)) {
    return "需要多平台分发内容的创作者和运营人员";
  }

  return "对该主题感兴趣、希望获得实用信息的泛内容用户";
};

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
  const [inputMode, setInputMode] = useState<InputMode>("draft");
  const [sourceText, setSourceText] = useState("");
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
  const [publishBrief, setPublishBrief] = useState<PublishBrief>({
    topic: "",
    intent: "",
    audience: "",
    trendSignals: "",
  });
  const [publishResults, setPublishResults] = useState<DeliveryResult[]>([]);
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, AdaptedContent>>({});
  const sourceDraft = useMemo(
    () => ({
      ...parseSourceContentToInput(sourceText, defaultPlatformIds),
      coverUrl: content.coverUrl,
      videoUrl: content.videoUrl,
    }),
    [content.coverUrl, content.videoUrl, sourceText],
  );
  const hasSourceDraft = Boolean(sourceText.trim());

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
  const briefTrendSignals = useMemo(
    () =>
      publishBrief.trendSignals
        .split(/\n|,|，|；|;/)
        .map((signal) => signal.trim())
        .filter(Boolean)
        .slice(0, 5),
    [publishBrief.trendSignals],
  );
  const hotSuggestions = useMemo(
    () =>
      briefTrendSignals.length
        ? briefTrendSignals.map((signal) => `${activePlatform.name} 可结合：${signal}`)
        : buildHotTopicSuggestions(content.title || "内容创作", activePlatform, preferences),
    [activePlatform, briefTrendSignals, content.title, preferences],
  );
  const publishResultByPlatform = useMemo(
    () =>
      new Map(
        publishResults.map((result) => [result.platformId, result]),
      ),
    [publishResults],
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

  const fillDemoSource = () => {
    setInputMode("draft");
    setSourceText(demoSourceText);
    setPublishBrief({
      topic: "AI 工具如何真正提升学习效率",
      intent: "把一篇已有经验稿改写成适合多平台分发的实用内容",
      audience: "学生、职场新人和内容创作者",
      trendSignals: "AI 原生应用\n效率工具\n学习方法\n真实经验复盘",
    });
    setPreferences({
      length: "medium",
      style: "practical",
      hotness: "trend",
    });
    setFlowStep("idle");
    setPublishResults([]);
    setPreviewOverrides({});
    pushMessages(
      createMessage(
        "assistant",
        "已填入一份演示原文。你可以直接点击生成发布包，查看六个平台的标题、正文和标签如何被分别改写。",
      ),
    );
  };

  const buildConfirmedPrompt = (
    latestInput: string,
    nextBrief = publishBrief,
    sourceContent?: ContentInput,
  ) =>
    [
      `发布主题：${nextBrief.topic || extractTopic(latestInput) || "待确认主题"}`,
      `核心表达：${nextBrief.intent || inferIntent(latestInput)}`,
      `目标受众：${nextBrief.audience || inferAudience(latestInput)}`,
      `发布平台：${platformCatalog.map((platform) => platform.name).join("、")}`,
      `内容长度：${lengthLabels[preferences.length]}`,
      `表达风格：${styleLabels[preferences.style]}`,
      `选题方式：${hotnessLabels[preferences.hotness]}`,
      `用户提供的真实热点/参考素材：${nextBrief.trendSignals || "未提供；不要编造实时热榜，只能给出平台化选题角度"}`,
      sourceContent?.body
        ? [
            "用户提供的原文/已有草稿如下，请优先保留原文事实、观点、案例和信息密度，只做平台化改写，不要改成无关选题：",
            `原文标题：${sourceContent.title || "未识别标题"}`,
            `原文标签：${sourceContent.tags.join("、") || "未识别标签"}`,
            `原文正文：${sourceContent.body.slice(0, 6000)}`,
          ].join("\n")
        : "用户未提供原文，需要根据 Brief 生成基础草稿。",
      `用户最新补充：${latestInput}`,
      "请生成一个多平台发布包，每个平台都要明显符合该平台风格；如果用户提供了原文，每个平台都必须围绕原文进行标题、正文、标签重写。",
    ].join("\n");

  const applyAgentPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    const sourceContent = hasSourceDraft ? sourceDraft : content;
    const effectivePrompt =
      trimmed ||
      (hasSourceDraft
        ? "请基于左侧原文进行多平台适配，保留核心观点并优化标题、正文和标签"
        : "");

    if (!effectivePrompt || isAgentThinking) {
      return;
    }

    const nextBrief = {
      topic: publishBrief.topic || sourceDraft.title || extractTopic(effectivePrompt),
      intent: publishBrief.intent || inferIntent(`${effectivePrompt}\n${sourceText}`),
      audience: publishBrief.audience || inferAudience(`${effectivePrompt}\n${sourceText}`),
      trendSignals: publishBrief.trendSignals,
    };
    const confirmedPrompt = buildConfirmedPrompt(
      effectivePrompt,
      nextBrief,
      hasSourceDraft ? sourceDraft : undefined,
    );

    setPublishBrief(nextBrief);
    setAgentInput("");
    setIsAgentThinking(true);
    const userMessage = createMessage(
      "user",
      hasSourceDraft
        ? `${effectivePrompt}\n\n已粘贴原文：${sourceDraft.title || "未命名草稿"}`
        : effectivePrompt,
    );
    const thinkingMessage = createMessage(
      "assistant",
      "我会结合前面的交流、发布偏好和热点方向，更新右侧预览。",
    );
    const conversationForPlan: AgentConversationMessage[] = [
      ...messages.map((message) => ({ role: message.role, text: message.text })),
      { role: userMessage.role, text: userMessage.text },
    ];

    pushMessages(userMessage, thinkingMessage);

    const platformPack = await buildPlatformPackWithMiniMax({
      prompt: confirmedPrompt,
      brief: nextBrief,
      previousContent: sourceContent,
      conversation: conversationForPlan,
      preferences,
    });

    if (platformPack) {
      const primaryDraft =
        platformPack.drafts[platformPack.primaryPlatformId] ??
        Object.values(platformPack.drafts)[0];
      const platformId = primaryDraft.platformId as ProductPlatformId;

      setAgentStatus({
        mode: "connected",
        model: platformPack.model,
        message: "发布助理已生成多平台成稿；如果增强生成失败，会自动切换离线规则。",
      });
      setActivePlatformId(platformId);
      setContent({
        title: primaryDraft.title,
        body: primaryDraft.body,
        tags: primaryDraft.tags,
        coverUrl: content.coverUrl,
        videoUrl: content.videoUrl,
        selectedPlatformIds: defaultPlatformIds,
      });
      setPreviewOverrides(platformPack.drafts);
      setPublishResults([]);
      setFlowStep("publish");
      setAccountModalOpen(false);
      setIsAgentThinking(false);
      pushMessages(
        createMessage("assistant", platformPack.reply),
        createMessage(
          "assistant",
          "右侧已经生成各平台可直接发布的标题、正文和标签。你可以逐个平台编辑预览，也可以把全部平台加入发布队列。",
        ),
      );
      return;
    }

    const plan = await buildAgentPlanWithMiniMax(
      confirmedPrompt,
      sourceContent,
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
    setContent(
      hasSourceDraft
        ? {
            ...sourceDraft,
            title: sourceDraft.title || plan.content.title,
            tags: sourceDraft.tags.length ? sourceDraft.tags : plan.content.tags,
            selectedPlatformIds: defaultPlatformIds,
          }
        : {
            ...plan.content,
            selectedPlatformIds: defaultPlatformIds,
          },
    );
    setPreviewOverrides({});
    setPublishResults([]);
    setFlowStep("publish");
    setAccountModalOpen(false);
    setIsAgentThinking(false);
    pushMessages(
      createMessage("assistant", plan.reply),
      createMessage(
        "assistant",
        `${plan.source === "minimax" ? "发布助理已生成草稿" : "已使用离线发布规则生成草稿"}。我已按发布 Brief 生成多平台发布包，你可以继续修改 Brief，或逐个平台检查标题、正文和标签。`,
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
  const generatedDraftCount = Object.keys(previewOverrides).length || previews.length;
  const generatedTagCount = previews.reduce((total, preview) => {
    const displayPreview = getPreviewForPlatform(preview);
    return total + displayPreview.adapted.tags.length;
  }, 0);
  const readyPlatformCount = previews.filter((preview) => {
    const displayPreview = getPreviewForPlatform(preview);
    return displayPreview.validation.canPublish;
  }).length;

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
            <p>面向创作者的多平台内容分发 MVP：原文识别、平台化改写、可编辑预览、发布队列和线上增强全部跑通。</p>
          </div>
          <div className="brand-actions">
            <strong>{cleanPreview ? `${previews.length} 个平台已适配` : "线上 Demo 可用"}</strong>
            <button type="button" onClick={fillDemoSource}>
              填入演示原文
            </button>
          </div>
        </div>

        <div className="proof-strip" aria-label="核心能力证明">
          <span>6 平台原生改写</span>
          <span>标题 / 正文 / 标签可编辑</span>
          <span>线上增强 + 离线兜底</span>
          <span>官方创作页 / Webhook 验证</span>
        </div>

        {!cleanPreview ? (
          <div className="home-page-layout">
            <div className="home-priority-grid">
              <article className="home-guide-card">
                <span>使用流程</span>
                <h2>先给内容，再生成六个平台发布包</h2>
                <p>用户可以粘贴已有草稿，也可以只输入主题和核心表达。系统会统一进入平台改写、预览编辑和发布队列。</p>
                <ol>
                  <li>选择输入模式</li>
                  <li>补充发布偏好</li>
                  <li>生成多平台预览</li>
                </ol>
              </article>

              <article className={`runtime-card ${agentStatus.mode}`}>
                <span>当前能力</span>
                <strong>
                  {agentStatus.mode === "connected"
                    ? "线上增强已就绪"
                    : agentStatus.mode === "key-missing"
                      ? "离线规则可用"
                      : "离线规则模式"}
                </strong>
                <p>{agentStatus.message}</p>
                <div className="agent-status">
                  <span className={stepState("idle")}>输入内容</span>
                  <span className={stepState("publish")}>平台适配</span>
                  <span className={stepState("done")}>发布队列</span>
                </div>
              </article>
            </div>

            <section className="mode-workspace-card" aria-label="内容输入">
              <div className="mode-workspace-heading">
                <div>
                  <span>内容入口</span>
                  <h2>{inputMode === "draft" ? "已有草稿模式" : "主题核心表达模式"}</h2>
                  <p>
                    {inputMode === "draft"
                      ? "适合用户已经有文章、笔记、产品介绍或活动文案，只需要多平台改写。"
                      : "适合用户只有选题方向，需要先补齐主题、表达、受众和素材。"}
                  </p>
                </div>
                <div className="mode-switch" role="tablist" aria-label="输入模式">
                  <button
                    type="button"
                    className={inputMode === "draft" ? "active" : ""}
                    onClick={() => setInputMode("draft")}
                  >
                    已有草稿
                  </button>
                  <button
                    type="button"
                    className={inputMode === "brief" ? "active" : ""}
                    onClick={() => setInputMode("brief")}
                  >
                    主题核心表达
                  </button>
                </div>
              </div>

              {inputMode === "draft" ? (
                <div className="source-draft-panel home-mode-panel" aria-label="原文粘贴区">
                  <div className="section-heading">
                    <small>1</small>
                    <div>
                      <span>原文 / 已有草稿</span>
                      <b>把用户已有内容粘贴进来，系统会先识别标题、正文和标签，再做平台化改写</b>
                    </div>
                  </div>
                  <textarea
                    value={sourceText}
                    onChange={(event) => setSourceText(event.target.value)}
                    placeholder={[
                      "可直接粘贴公众号文章、知乎回答、产品介绍、活动文案或带 #标签 的草稿。",
                      "例如：第一行写标题，正文写观点和案例，最后一行写 #标签。",
                    ].join("\n")}
                    rows={7}
                  />
                  <div className="source-draft-meta">
                    <span>{hasSourceDraft ? `已识别：${sourceDraft.title || "未命名草稿"}` : "等待粘贴原文"}</span>
                    <span>{hasSourceDraft ? `${sourceDraft.body.length} 字正文` : "正文会用于预览页"}</span>
                    <span>{hasSourceDraft ? `${sourceDraft.tags.length} 个标签` : "支持 #标签 或 标签：格式"}</span>
                  </div>
                </div>
              ) : (
                <div className="brief-panel home-mode-panel" aria-label="发布需求确认">
                  <div className="section-heading">
                    <small>1</small>
                    <div>
                      <span>发布 Brief</span>
                      <b>先确认主题、表达和受众，再生成多平台版本</b>
                    </div>
                  </div>
                  <label>
                    主题
                    <input
                      value={publishBrief.topic}
                      onChange={(event) =>
                        setPublishBrief((current) => ({ ...current, topic: event.target.value }))
                      }
                      placeholder="例如：字节跳动公司的产品增长方法"
                    />
                  </label>
                  <label>
                    核心表达
                    <textarea
                      value={publishBrief.intent}
                      onChange={(event) =>
                        setPublishBrief((current) => ({ ...current, intent: event.target.value }))
                      }
                      placeholder="例如：讲清楚它为什么能持续做出高频产品，并总结普通团队能借鉴的方法"
                      rows={3}
                    />
                  </label>
                  <label>
                    目标读者
                    <input
                      value={publishBrief.audience}
                      onChange={(event) =>
                        setPublishBrief((current) => ({ ...current, audience: event.target.value }))
                      }
                      placeholder="例如：创作者、产品经理、互联网从业者"
                    />
                  </label>
                  <label>
                    热点素材或参考链接
                    <textarea
                      value={publishBrief.trendSignals}
                      onChange={(event) =>
                        setPublishBrief((current) => ({
                          ...current,
                          trendSignals: event.target.value,
                        }))
                      }
                      placeholder="可粘贴热榜词、爆文标题、参考链接；未填写时只做平台化选题角度，不伪造实时热点"
                      rows={3}
                    />
                  </label>
                  <div className="platform-chip-row">
                    {platformCatalog.map((platform) => (
                      <span key={platform.id}>{platform.name}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="preference-panel home-preference-panel" aria-label="发布偏好">
                <div className="section-heading compact">
                  <small>2</small>
                  <div>
                    <span>发布偏好</span>
                    <b>两个输入模式共用这组偏好</b>
                  </div>
                </div>
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
              </div>

              <div className="home-action-row">
                <button type="button" onClick={fillDemoSource}>
                  填入演示原文
                </button>
                <button
                  type="button"
                  className="primary-home-action"
                  disabled={isAgentThinking || (inputMode === "draft" && !hasSourceDraft)}
                  onClick={() =>
                    void applyAgentPrompt(
                      inputMode === "draft"
                        ? "请基于左侧原文生成多平台发布包，保留核心观点，分别优化标题、正文和标签"
                        : "确认当前发布 Brief，并生成多平台发布包",
                    )
                  }
                >
                  {isAgentThinking ? "正在生成..." : "生成多平台发布包"}
                </button>
              </div>
            </section>

            <div className="home-preview-teaser">
              <article>
                <b>预览页会展示</b>
                <span>六个平台标题、正文、标签和发布体检</span>
              </article>
              <article>
                <b>发布页会完成</b>
                <span>编辑草稿、生成队列、打开官方创作页</span>
              </article>
            </div>
          </div>
        ) : (
          <div className="preview-page-layout">
            <div className="preview-top-grid">
              <form className="agent-input-card preview-requirement-card" onSubmit={submitPrompt}>
                <div className="section-heading compact">
                  <small>补充</small>
                  <div>
                    <span>预览页补充要求</span>
                    <b>需要更口语、更专业，或指定某个平台重点优化时，在这里继续调整</b>
                  </div>
                </div>
                <textarea
                  value={agentInput}
                  onChange={(event) => setAgentInput(event.target.value)}
                  placeholder="例如：保留原文观点，小红书更轻松，知乎更专业，微博更适合转发讨论"
                  rows={3}
                />
                <div className="quick-prompt-row" aria-label="示例补充要求">
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
                <button type="submit" disabled={isAgentThinking}>
                  {isAgentThinking ? "更新中..." : "更新发布包"}
                </button>
              </form>

              <article className="brief-summary-card">
                <span>发布 Brief 总览</span>
                <h2>{publishBrief.topic || content.title}</h2>
                <p>{publishBrief.intent || "同一份内容已按平台语境自动改写，可逐个平台编辑和发布。"}</p>
                <div>
                  <em>{publishBrief.audience || "目标读者待补充"}</em>
                  <em>{lengthLabels[preferences.length]}</em>
                  <em>{styleLabels[preferences.style]}</em>
                  <em>{hotnessLabels[preferences.hotness]}</em>
                </div>
              </article>
            </div>

            <div className="result-metric-grid" aria-label="发布包指标">
              <article>
                <span>{generatedDraftCount}</span>
                <b>平台版本</b>
              </article>
              <article>
                <span>{generatedTagCount}</span>
                <b>标签建议</b>
              </article>
              <article>
                <span>{readyPlatformCount}</span>
                <b>体检通过</b>
              </article>
              <article>
                <span>{publishResults.length || "待"}</span>
                <b>发布队列</b>
              </article>
            </div>

            <div className="preview-main-grid">
              <section className="preview-left-stack" aria-label="平台预览和队列">
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

                <div className="publish-queue-card">
                  <div>
                    <span>全平台发布队列</span>
                    <strong>{publishResults.length ? "队列已生成" : "待生成队列"}</strong>
                  </div>
                  <div className="queue-lanes">
                    {previews.map((preview) => {
                      const platform = getPlatformById(preview.adapted.platformId);
                      const result = publishResultByPlatform.get(platform.id);

                      return (
                        <article key={platform.id} className={result ? "done" : "ready"}>
                          <b>{platform.name}</b>
                          <span>{result ? "已进入发布队列" : "草稿已生成"}</span>
                          <small>{result?.message ?? platform.promise}</small>
                          <a href={platform.creatorUrl || platform.loginUrl} target="_blank" rel="noreferrer">
                            打开创作页
                          </a>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="hot-topic-card">
                  <div>
                    <span>{activePlatform.name} 选题素材</span>
                    <strong>{hotnessLabels[preferences.hotness]} · {styleLabels[preferences.style]}</strong>
                  </div>
                  <ul>
                    {hotSuggestions.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="preview-right-stack" aria-label="编辑和发布">
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
                  <div className="publish-action-heading">
                    <div>
                      <span>发布前确认</span>
                      <h3>{activePlatform.name} 发布舱</h3>
                      <p>
                        已准备好标题、正文和标签。点击主按钮后会打开官方创作页，并把当前草稿加入发布队列。
                      </p>
                    </div>
                    <div className={`score-card ${scoreTone(cleanPreview.validation.score)}`}>
                      <span>{cleanPreview.validation.score}</span>
                      <p>{cleanPreview.validation.canPublish ? "体检通过" : "需处理"}</p>
                    </div>
                  </div>

                  <div className="publish-ritual-rail" aria-label="发布流程">
                    <article className="done">
                      <b>1</b>
                      <span>平台草稿</span>
                      <small>已生成可编辑内容</small>
                    </article>
                    <article className={accountConnected ? "done" : "current"}>
                      <b>2</b>
                      <span>账号确认</span>
                      <small>{accountConnected ? "已确认登录状态" : "确认后继续发布"}</small>
                    </article>
                    <article className={cleanPreview.validation.canPublish ? "current" : ""}>
                      <b>3</b>
                      <span>送往创作页</span>
                      <small>复制草稿并打开官方页面</small>
                    </article>
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
                    {isPublishing ? "正在送往创作页..." : `确认并发布到 ${activePlatform.name} 创作页`}
                  </button>
                  <p className="publish-final-note">
                    为了符合真实平台规则，最终“发布”由你在官方创作页手动确认；本系统负责生成、校验、复制和打开发布入口。
                  </p>
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
              </section>
            </div>
          </div>
        )}
      </section>

      {isAgentThinking ? (
        <div className="generation-status" role="status" aria-live="polite">
          <strong>正在生成多平台发布包</strong>
          <span>发布助理会优先调用线上增强能力；若服务不可用，会自动切换离线规则。</span>
        </div>
      ) : null}

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

import type { AdaptedContent, ContentInput } from "../types/content";
import {
  buildAgentPlan,
  buildAgentPlanFromRemote,
  type AgentConversationMessage,
  type AgentPlan,
  type AgentPreferences,
  type RemoteAgentPlan,
} from "./agentPlanner";

type AgentApiResponse =
  | {
      ok: true;
      plan: RemoteAgentPlan;
      model?: string;
    }
  | {
      ok: false;
      error: string;
    };

type PlatformPackApiResponse =
  | {
      ok: true;
      pack: RemotePlatformPack;
      model?: string;
    }
  | {
      ok: false;
      error: string;
    };

export type PlatformPackBrief = {
  topic: string;
  intent: string;
  audience: string;
  trendSignals: string;
};

export type RemotePlatformDraft = {
  platformId: string;
  title?: string;
  body?: string;
  summary?: string;
  tags?: string[];
  strategyNotes?: string[];
};

export type RemotePlatformPack = {
  reply?: string;
  primaryPlatformId?: string;
  drafts?: RemotePlatformDraft[];
};

export type GeneratedPlatformPack = {
  source: "minimax";
  reply: string;
  primaryPlatformId: string;
  drafts: Record<string, AdaptedContent>;
  model?: string;
};

const localAgentOrigin = "http://127.0.0.1:8787";
const onlineAgentOrigin = "https://contentbridge.onrender.com";

const resolveDefaultAgentEndpoint = (path: string) => {
  const configuredBaseUrl = import.meta.env.VITE_AGENT_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/+$/, "")}${path}`;
  }

  if (typeof window === "undefined") {
    return `${localAgentOrigin}${path}`;
  }

  const isLocalDev =
    ["127.0.0.1", "localhost"].includes(window.location.hostname) &&
    window.location.port !== "8787";

  return `${isLocalDev ? onlineAgentOrigin : window.location.origin}${path}`;
};

const defaultAgentApiUrl = resolveDefaultAgentEndpoint("/api/agent-plan");
const defaultPlatformPackApiUrl = resolveDefaultAgentEndpoint("/api/platform-pack");
const defaultAgentHealthUrl = resolveDefaultAgentEndpoint("/api/agent-health");

export type MiniMaxAgentStatus = {
  mode: "connected" | "proxy-missing" | "key-missing";
  message: string;
  model?: string;
};

export async function checkMiniMaxAgentStatus(): Promise<MiniMaxAgentStatus> {
  const endpoint =
    import.meta.env.VITE_AGENT_HEALTH_URL?.trim() || defaultAgentHealthUrl;

  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new Error(`Agent health returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      configured?: boolean;
      model?: string;
      message?: string;
    };

    if (!data.configured) {
      return {
        mode: "key-missing",
        model: data.model,
        message: "增强生成服务待配置，当前会使用离线规则。",
      };
    }

    return {
      mode: "connected",
      model: data.model,
      message: "增强生成已就绪；如果生成失败，会自动切换离线规则。",
    };
  } catch {
    return {
      mode: "proxy-missing",
      message: "增强生成服务未启动，当前会使用离线规则。",
    };
  }
}

export async function buildAgentPlanWithMiniMax(
  prompt: string,
  previousContent?: ContentInput,
  conversation: AgentConversationMessage[] = [],
  preferences?: AgentPreferences,
): Promise<AgentPlan> {
  const endpoint =
    import.meta.env.VITE_AGENT_API_URL?.trim() || defaultAgentApiUrl;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        previousContent,
        conversation,
        preferences,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent API returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as AgentApiResponse;

    if (!data.ok) {
      throw new Error(data.error);
    }

    return buildAgentPlanFromRemote(data.plan, prompt, previousContent, preferences);
  } catch {
    const contextPrompt = [
      ...conversation
        .filter((message) => message.role === "user")
        .map((message) => message.text),
      prompt,
    ].join("\n");

    return buildAgentPlan(contextPrompt, previousContent, preferences);
  }
}

export async function buildPlatformPackWithMiniMax({
  prompt,
  brief,
  previousContent,
  conversation = [],
  preferences,
}: {
  prompt: string;
  brief: PlatformPackBrief;
  previousContent?: ContentInput;
  conversation?: AgentConversationMessage[];
  preferences?: AgentPreferences;
}): Promise<GeneratedPlatformPack | null> {
  const endpoint =
    import.meta.env.VITE_PLATFORM_PACK_API_URL?.trim() || defaultPlatformPackApiUrl;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        brief,
        previousContent,
        conversation,
        preferences,
      }),
    });

    if (!response.ok) {
      throw new Error(`Platform pack API returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as PlatformPackApiResponse;

    if (!data.ok) {
      throw new Error(data.error);
    }

    const drafts = (data.pack.drafts ?? []).reduce<Record<string, AdaptedContent>>(
      (collection, draft) => {
        const platformId = String(draft.platformId ?? "").trim();

        if (!platformId || !draft.title?.trim() || !draft.body?.trim()) {
          return collection;
        }

        collection[platformId] = {
          platformId,
          title: draft.title.trim(),
          body: draft.body.trim(),
          summary: draft.summary?.trim(),
          tags: Array.isArray(draft.tags)
            ? draft.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8)
            : [],
          strategyNotes: Array.isArray(draft.strategyNotes)
            ? draft.strategyNotes
                .map((note) => String(note).trim())
                .filter(Boolean)
                .slice(0, 6)
            : [],
        };

        return collection;
      },
      {},
    );

    const draftIds = Object.keys(drafts);

    if (!draftIds.length) {
      throw new Error("Platform pack did not include usable drafts");
    }

    const primaryPlatformId =
      data.pack.primaryPlatformId && drafts[data.pack.primaryPlatformId]
        ? data.pack.primaryPlatformId
        : draftIds[0];

    return {
      source: "minimax",
      reply:
        data.pack.reply?.trim() ||
        "发布助理已经生成多平台成稿，你可以在右侧逐个平台检查标题、正文和标签。",
      primaryPlatformId,
      drafts,
      model: data.model,
    };
  } catch {
    return null;
  }
}

import type { ContentInput } from "../types/content";
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

const defaultAgentApiUrl = "http://127.0.0.1:8787/api/agent-plan";
const defaultAgentHealthUrl = "http://127.0.0.1:8787/api/agent-health";

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

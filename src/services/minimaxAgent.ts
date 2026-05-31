import type { ContentInput } from "../types/content";
import {
  buildAgentPlan,
  buildAgentPlanFromRemote,
  type AgentPlan,
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
        message: "MiniMax 代理已启动，但没有配置 MINIMAX_API_KEY，当前会使用本地 Agent 降级。",
      };
    }

    return {
      mode: "connected",
      model: data.model,
      message: data.message ?? "MiniMax Agent 已连接。",
    };
  } catch {
    return {
      mode: "proxy-missing",
      message: "MiniMax 代理未启动，当前会使用本地 Agent 降级。运行 npm run dev:agent 可启用。",
    };
  }
}

export async function buildAgentPlanWithMiniMax(
  prompt: string,
  previousContent?: ContentInput,
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
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent API returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as AgentApiResponse;

    if (!data.ok) {
      throw new Error(data.error);
    }

    return buildAgentPlanFromRemote(data.plan, prompt, previousContent);
  } catch {
    return buildAgentPlan(prompt, previousContent);
  }
}

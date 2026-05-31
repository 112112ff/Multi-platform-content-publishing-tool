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

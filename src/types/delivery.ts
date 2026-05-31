import type { AccountChannel } from "../integrations/matrixOperationEngine";

export type ConnectedAccount = AccountChannel & {
  status: "connected" | "disconnected";
  connectedAt?: string;
  loginUrl: string;
  loginLabel: string;
};

export type DeliveryResult = {
  id: string;
  platformId: string;
  accountName: string;
  status: "success" | "failed" | "blocked";
  executionRoute: string;
  message: string;
  createdAt: string;
  receiverUrl?: string;
};

import type { ConnectedAccount, DeliveryResult } from "../types/delivery";

interface MatrixDeliveryPanelProps {
  desiredAccountConnections: ConnectedAccount[];
  hasMissingAccountConnections: boolean;
  receiverUrl: string;
  isPublishing: boolean;
  publishJobsLength: number;
  publishResults: DeliveryResult[];
  getPlatformLabel: (platformId: string) => string;
  getAccountStatusLabel: (status: ConnectedAccount["status"]) => string;
  getPublishResultLabel: (status: DeliveryResult["status"]) => string;
  onOpenAccountModal: (reason: string) => void;
  onReceiverUrlChange: (value: string) => void;
  onDeliver: () => void;
}

export function MatrixDeliveryPanel({
  desiredAccountConnections,
  hasMissingAccountConnections,
  receiverUrl,
  isPublishing,
  publishJobsLength,
  publishResults,
  getPlatformLabel,
  getAccountStatusLabel,
  getPublishResultLabel,
  onOpenAccountModal,
  onReceiverUrlChange,
  onDeliver,
}: MatrixDeliveryPanelProps) {
  return (
    <section className="matrix-plan-card">
      <h3>账号矩阵任务</h3>
      <div className="account-mini-list">
        {desiredAccountConnections.length ? (
          desiredAccountConnections.map((account) => (
            <button
              type="button"
              key={account.id}
              className={account.status === "connected" ? "connected" : ""}
              onClick={() =>
                onOpenAccountModal(
                  `${account.displayName} 用于 ${getPlatformLabel(
                    account.platformId,
                  )} 的热点洞察和草稿准备。`,
                )
              }
            >
              <span>{account.displayName}</span>
              <b>{getAccountStatusLabel(account.status)}</b>
            </button>
          ))
        ) : (
          <p>当前平台不强制连接账号，可以先手动导出或继续改写。</p>
        )}
      </div>
      {hasMissingAccountConnections ? (
        <button
          type="button"
          className="connect-inline-button"
          onClick={() =>
            onOpenAccountModal(
              "连接账号后，Agent 可以继续准备平台草稿、读取账号可见热点，并避免矩阵内容重复。",
            )
          }
        >
          连接缺失账号
        </button>
      ) : null}
      <label className="real-delivery-field">
        真实投递接收端
        <input
          value={receiverUrl}
          onChange={(event) => onReceiverUrlChange(event.target.value)}
          placeholder="https://webhook.site/... 或你的后端接收 URL"
        />
      </label>
      <button
        type="button"
        className="real-delivery-button"
        disabled={!publishJobsLength || isPublishing}
        onClick={onDeliver}
      >
        {isPublishing ? "真实投递中..." : "真实投递到接收端"}
      </button>
      {publishResults.length ? (
        <div className="publish-result-list" aria-label="真实投递结果">
          {publishResults.map((result) => (
            <article className={result.status} key={result.id}>
              <div>
                <span>{getPlatformLabel(result.platformId)}</span>
                <strong>{result.accountName}</strong>
                <p>{result.message}</p>
                <small>
                  {result.executionRoute} · {result.receiverUrl ?? "未投递"} ·{" "}
                  {new Intl.DateTimeFormat("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(result.createdAt))}
                </small>
              </div>
              <b>{getPublishResultLabel(result.status)}</b>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

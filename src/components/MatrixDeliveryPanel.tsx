import type { ConnectedAccount, DeliveryResult } from "../types/delivery";

interface MatrixDeliveryPanelProps {
  desiredAccountConnections: ConnectedAccount[];
  missingAccountConnections: ConnectedAccount[];
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
  onDeliverToExtension: () => void;
}

export function MatrixDeliveryPanel({
  desiredAccountConnections,
  missingAccountConnections,
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
  onDeliverToExtension,
}: MatrixDeliveryPanelProps) {
  const hasMissingAccountConnections = missingAccountConnections.length > 0;

  return (
    <section className="matrix-plan-card">
      <h3>账号矩阵任务</h3>
      <p className="matrix-plan-hint">
        填测试接收地址可以验证真实投递；发送到平台创作页前，需要先确认对应平台已在浏览器登录。
      </p>
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
        <div className="account-warning">
          <p>
            还差 {missingAccountConnections.length} 个平台确认登录：
            {missingAccountConnections
              .map((account) => getPlatformLabel(account.platformId))
              .join("、")}
          </p>
          <button
            type="button"
            className="connect-inline-button"
            onClick={() =>
              onOpenAccountModal(
                "确认平台登录后，浏览器扩展才能打开创作页并填充草稿。这里不会保存账号密码。",
              )
            }
          >
            去确认登录
          </button>
        </div>
      ) : (
        <p className="account-ready">目标平台已确认登录，可以发送到浏览器扩展。</p>
      )}
      <label className="real-delivery-field">
        测试接收地址（可选）
        <input
          value={receiverUrl}
          onChange={(event) => onReceiverUrlChange(event.target.value)}
          placeholder="https://webhook.site/... 或你的接收服务 URL"
        />
      </label>
      <button
        type="button"
        className="real-delivery-button"
        disabled={!publishJobsLength || isPublishing}
        onClick={onDeliver}
      >
        {isPublishing ? "发送中..." : "发送到测试接收端"}
      </button>
      <button
        type="button"
        className={`extension-delivery-button ${hasMissingAccountConnections ? "needs-account" : ""}`}
        disabled={!publishJobsLength || isPublishing}
        onClick={onDeliverToExtension}
      >
        {isPublishing
          ? "发送中..."
          : hasMissingAccountConnections
            ? "先确认登录，再发送草稿"
            : "发送到浏览器扩展"}
      </button>
      <p className="delivery-note">
        浏览器扩展路线会复用用户自己的平台登录态，打开创作页并尝试填充草稿，最终发布仍需人工确认。
      </p>
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

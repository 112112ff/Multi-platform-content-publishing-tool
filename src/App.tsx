const workflowSteps = [
  "输入原始内容",
  "选择目标平台",
  "生成平台版本",
  "预览编辑",
  "模拟发布",
];

const platforms = ["公众号", "知乎", "B站", "小红书"];

function App() {
  return (
    <main className="app-shell">
      <section className="intro-panel" aria-labelledby="product-title">
        <p className="eyebrow">ContentBridge MVP</p>
        <h1 id="product-title">多平台内容发布工具</h1>
        <p className="lead">
          一次输入内容，自动适配公众号、知乎、B站、小红书等平台格式与风格，并模拟一键发布。
        </p>
      </section>

      <section className="workspace" aria-label="工作台概览">
        <div className="editor-preview">
          <div>
            <span className="section-label">原始内容</span>
            <h2>创作者输入区</h2>
            <p>
              后续将在这里填写标题、正文、标签、封面图和视频链接，作为各平台适配的统一内容源。
            </p>
          </div>
          <button type="button">开始适配</button>
        </div>

        <div className="platform-grid" aria-label="目标平台">
          {platforms.map((platform) => (
            <article className="platform-card" key={platform}>
              <span>{platform}</span>
              <strong>待生成</strong>
              <p>平台风格、格式校验和发布模拟将在后续 PR 中接入。</p>
            </article>
          ))}
        </div>
      </section>

      <section className="flow" aria-labelledby="flow-title">
        <h2 id="flow-title">MVP 流程</h2>
        <ol>
          {workflowSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}

export default App;

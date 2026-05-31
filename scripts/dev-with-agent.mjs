import { spawn } from "node:child_process";
import "./minimax-proxy.mjs";

process.env.VITE_AGENT_BASE_URL ??= "http://127.0.0.1:8787";

const vite = spawn("npm", ["run", "dev"], {
  cwd: new URL("..", import.meta.url),
  shell: true,
  stdio: "inherit",
});

vite.on("exit", (code) => {
  process.exit(code ?? 0);
});

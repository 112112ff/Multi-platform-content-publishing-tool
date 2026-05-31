import { spawn } from "node:child_process";
import "./minimax-proxy.mjs";

const vite = spawn("npm", ["run", "dev"], {
  cwd: new URL("..", import.meta.url),
  shell: true,
  stdio: "inherit",
});

vite.on("exit", (code) => {
  process.exit(code ?? 0);
});

import { spawn } from "node:child_process";

const env = { ...process.env };
if (process.platform === "darwin" && !env.DEVELOPER_DIR) {
  env.DEVELOPER_DIR = "/Library/Developer/CommandLineTools";
}

const pyCmd = process.platform === "win32" ? "python" : "python3";
const proc = spawn(pyCmd, ["-m", "uvicorn", "main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"], {
  stdio: "inherit",
  shell: true,
  env,
});

proc.on("exit", (code) => {
  process.exit(code ?? 0);
});

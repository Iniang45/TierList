const { spawn } = require("child_process");

function start(command, args, name) {
  const child = spawn(command, args, {
    shell: true,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  return child;
}

const api = start("npm", ["run", "dev:api"], "api");
const client = start("npm", ["run", "dev:client"], "client");

function shutdown(signal) {
  if (api && !api.killed) api.kill(signal);
  if (client && !client.killed) client.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

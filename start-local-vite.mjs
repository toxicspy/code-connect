import { createServer } from "vite";
import config from "./vite.config.mjs";

const resolvedConfig = typeof config === "function"
  ? await config({ command: "serve", mode: "development" })
  : config;

const server = await createServer({
  ...resolvedConfig,
  configFile: false,
  server: {
    ...(resolvedConfig.server || {}),
    host: "127.0.0.1",
    port: 8080,
  },
  optimizeDeps: {
    ...(resolvedConfig.optimizeDeps || {}),
    noDiscovery: true,
    include: [],
  },
});

await server.listen();
server.printUrls();

setInterval(() => {}, 1 << 30);

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import vm from "vm";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { transform } from "sucrase";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const rootDir = __dirname;
const srcDir = path.join(rootDir, "src");
const publicDir = path.join(rootDir, "public");
const envPath = path.join(rootDir, ".env");
const port = 8080;

const env = loadEnvFile(envPath);
const envObjectLiteral = JSON.stringify({
  ...env,
  BASE_URL: "/",
  MODE: "development",
  DEV: true,
  PROD: false,
});

const tailwindConfig = loadTsConfig(path.join(rootDir, "tailwind.config.ts"));
let compiledCss = "";

await buildCss();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const entries = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      const key = line.slice(0, index);
      let value = line.slice(index + 1);
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [key, value];
    });
  return Object.fromEntries(entries);
}

function loadTsConfig(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const transpiled = transform(source, {
    transforms: ["typescript", "imports"],
    production: true,
  }).code;

  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    require,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    process,
    console,
  };

  const script = new vm.Script(transpiled, { filename: filePath });
  script.runInNewContext(context);

  return module.exports.default ?? module.exports;
}

async function buildCss() {
  const cssSource = fs.readFileSync(path.join(srcDir, "index.css"), "utf8");
  const result = await postcss([tailwindcss(tailwindConfig)]).process(cssSource, {
    from: path.join(srcDir, "index.css"),
  });
  compiledCss = result.css;
}

function getContentType(filePath) {
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".png")) return "image/png";
  return "text/plain; charset=utf-8";
}

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(body);
}

function resolveLocalFile(importerFile, specifier) {
  const basePath = specifier.startsWith("@/")
    ? path.join(srcDir, specifier.slice(2))
    : specifier.startsWith("/")
      ? path.join(rootDir, specifier.slice(1))
      : path.resolve(path.dirname(importerFile), specifier);

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.json`,
    `${basePath}.css`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.jsx"),
  ];

  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolved) {
    throw new Error(`Unable to resolve "${specifier}" from ${importerFile}`);
  }
  return resolved;
}

function toBrowserPath(filePath) {
  const rel = path.relative(rootDir, filePath).replace(/\\/g, "/");
  return `/@local/${rel}`;
}

function rewriteImports(code, importerFile) {
  let next = code.replace(/import\.meta\.env\b/g, envObjectLiteral);

  const rewriteSpecifier = (specifier) => {
    if (specifier.startsWith("http://") || specifier.startsWith("https://")) return specifier;

    if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("@/")) {
      const resolved = resolveLocalFile(importerFile, specifier);
      if (resolved.endsWith(".css")) {
        return `${toBrowserPath(resolved)}?css`;
      }
      return toBrowserPath(resolved);
    }

    if (specifier === "react") return "https://esm.sh/react@18.3.1?dev";
    if (specifier === "react-dom") return "https://esm.sh/react-dom@18.3.1?dev";
    if (specifier === "react-dom/client") return "https://esm.sh/react-dom@18.3.1/client?dev&external=react";
    if (specifier === "react/jsx-runtime") return "https://esm.sh/react@18.3.1/jsx-runtime?dev";
    if (specifier === "react/jsx-dev-runtime") return "https://esm.sh/react@18.3.1/jsx-dev-runtime?dev";

    return `https://esm.sh/${specifier}?dev&external=react,react-dom`;
  };

  next = next.replace(/(from\s+["'])([^"']+)(["'])/g, (_, prefix, specifier, suffix) => (
    `${prefix}${rewriteSpecifier(specifier)}${suffix}`
  ));

  next = next.replace(/(import\s*\(\s*["'])([^"']+)(["']\s*\))/g, (_, prefix, specifier, suffix) => (
    `${prefix}${rewriteSpecifier(specifier)}${suffix}`
  ));

  next = next.replace(/(export\s+\*\s+from\s+["'])([^"']+)(["'])/g, (_, prefix, specifier, suffix) => (
    `${prefix}${rewriteSpecifier(specifier)}${suffix}`
  ));

  next = next.replace(/(export\s+\{[^}]*\}\s+from\s+["'])([^"']+)(["'])/g, (_, prefix, specifier, suffix) => (
    `${prefix}${rewriteSpecifier(specifier)}${suffix}`
  ));

  return next;
}

function transpileModule(filePath) {
  const source = fs.readFileSync(filePath, "utf8");

  if (filePath.endsWith(".css")) {
    const css = fs.readFileSync(filePath, "utf8");
    return `
const style = document.createElement("style");
style.setAttribute("data-source", ${JSON.stringify(filePath)});
style.textContent = ${JSON.stringify(css)};
document.head.appendChild(style);
export default style;
`;
  }

  if (filePath.endsWith(".json")) {
    return `export default ${source.trim()};`;
  }

  const transforms = [];
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) transforms.push("typescript");
  if (filePath.endsWith(".jsx") || filePath.endsWith(".tsx")) transforms.push("jsx");

  const transpiled = transforms.length > 0
    ? transform(source, {
        transforms,
        production: false,
        jsxRuntime: "automatic",
      }).code
    : source;

  return rewriteImports(transpiled, filePath);
}

function buildHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Code Connect</title>
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@18.3.1?dev",
          "react-dom": "https://esm.sh/react-dom@18.3.1?dev",
          "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?dev&external=react",
          "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime?dev",
          "react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime?dev"
        }
      }
    </script>
    <link rel="stylesheet" href="/@app/index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/@local/src/main.tsx"></script>
  </body>
</html>`;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === "/") {
      return send(response, 200, buildHtml(), "text/html; charset=utf-8");
    }

    if (pathname === "/@app/index.css") {
      return send(response, 200, compiledCss, "text/css; charset=utf-8");
    }

    if (pathname.startsWith("/public/")) {
      const publicFile = path.join(rootDir, pathname.slice(1));
      if (fs.existsSync(publicFile)) {
        return send(response, 200, fs.readFileSync(publicFile), getContentType(publicFile));
      }
    }

    if (pathname.startsWith("/@local/")) {
      const rel = pathname.slice("/@local/".length);
      const localFile = path.join(rootDir, rel);
      if (!fs.existsSync(localFile)) {
        return send(response, 404, `Not found: ${rel}`);
      }
      const output = transpileModule(localFile);
      return send(response, 200, output, "application/javascript; charset=utf-8");
    }

    if (pathname.startsWith("/favicon") || pathname.startsWith("/robots")) {
      const publicFile = path.join(publicDir, pathname.replace(/^\//, ""));
      if (fs.existsSync(publicFile)) {
        return send(response, 200, fs.readFileSync(publicFile), getContentType(publicFile));
      }
    }

    return send(response, 404, `Not found: ${pathname}`);
  } catch (error) {
    console.error(error);
    return send(response, 500, String(error?.stack || error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Fallback dev server running at http://127.0.0.1:${port}/`);
});

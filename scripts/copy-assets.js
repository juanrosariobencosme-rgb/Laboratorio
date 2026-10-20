const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.dirname(
  require.resolve("@fortawesome/fontawesome-free/package.json")
);
const outputRoot = path.join(__dirname, "..", "public", "vendor", "fontawesome");

fs.mkdirSync(path.join(outputRoot, "css"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "webfonts"), { recursive: true });
fs.copyFileSync(
  path.join(packageRoot, "css", "all.min.css"),
  path.join(outputRoot, "css", "all.min.css")
);

for (const file of fs.readdirSync(path.join(packageRoot, "webfonts"))) {
  if (file.endsWith(".woff2")) {
    fs.copyFileSync(
      path.join(packageRoot, "webfonts", file),
      path.join(outputRoot, "webfonts", file)
    );
  }
}

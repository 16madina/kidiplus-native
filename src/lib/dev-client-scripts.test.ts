import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function run() {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.match(pkg.scripts.start, /--dev-client/, "npm start must target KiDi+ not Expo Go");
  console.log("dev-client-scripts: all checks passed");
}

run();

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
export const load = require("jiti")(import.meta.url, { alias: { "@": root } });

let passed = 0;
let failed = 0;
export function test(name, run) {
  return Promise.resolve()
    .then(run)
    .then(() => {
      passed += 1;
      console.log("ok   " + name);
    })
    .catch((error) => {
      failed += 1;
      process.exitCode = 1;
      console.log("FAIL " + name + "\n     " + error.message);
    });
}
export function summary(label) {
  console.log("\n" + label + ": " + passed + " passed, " + failed + " failed");
}

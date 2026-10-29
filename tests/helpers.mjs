import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
export const load = require("jiti")(import.meta.url, { alias: { "@": root } });

/**
 * The register of scholars and supervisors is not part of the code (it is in the database), so a
 * test that needs it reads the copy kept on this computer, data/research-register.seed.json.
 */
export function seedRegister() {
  const file = path.join(root, "data", "research-register.seed.json");
  if (!fs.existsSync(file)) {
    throw new Error(
      "data/research-register.seed.json is missing. It is kept only on the Research Office computer.",
    );
  }
  const seed = JSON.parse(fs.readFileSync(file, "utf8"));
  // The module loader keeps a separate copy of a module for each way it is named in a test.
  for (const name of ["@/lib/register.ts", "@/lib/register"])
    load(name).applyRegisterSeed(seed);
}

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
      if (process.env.STACK) console.log(error.stack);
    });
}
export function summary(label) {
  console.log("\n" + label + ": " + passed + " passed, " + failed + " failed");
}

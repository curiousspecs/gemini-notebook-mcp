import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Run the real entry point with all data paths sandboxed; return its streams. */
function run(args: string[]) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnm-stdout-"));
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of [
    "LOCALAPPDATA",
    "APPDATA",
    "XDG_DATA_HOME",
    "XDG_CONFIG_HOME",
    "XDG_CACHE_HOME",
    "HOME",
    "USERPROFILE",
  ]) {
    env[k] = tmp;
  }
  return spawnSync(
    process.execPath,
    [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts", ...args],
    {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 60_000,
    }
  );
}

test("config subcommands write nothing to stdout (stdout is the MCP channel)", () => {
  for (const args of [
    ["config", "get"],
    ["config", "set", "profile", "minimal"],
    ["config", "reset"],
    ["config", "help"],
  ]) {
    const r = run(args);
    assert.equal(r.stdout, "", `stdout must be empty for: ${args.join(" ")}`);
    assert.ok(r.stderr.length > 0, `expected output on stderr for: ${args.join(" ")}`);
  }
});

test("no console.log / console.info / process.stdout in src", () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (
        /\.ts$/.test(e.name) &&
        /console\.(log|info|debug)\(|process\.stdout/.test(fs.readFileSync(p, "utf8"))
      ) {
        offenders.push(path.relative(root, p));
      }
    }
  };
  walk(path.join(root, "src"));
  assert.deepEqual(offenders, []);
});

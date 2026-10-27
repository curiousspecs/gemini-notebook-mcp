import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { PassThrough } from "node:stream";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { watchStdinClose } from "../src/utils/stdin-shutdown.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("watchStdinClose fires on end and on close", async () => {
  const a = new PassThrough();
  const seen: string[] = [];
  watchStdinClose(a, (r) => seen.push(r));
  a.end();
  a.resume();
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(seen.includes("stdin-end"));
  assert.ok(seen.includes("stdin-close"));

  const b = new PassThrough();
  const abrupt: string[] = [];
  watchStdinClose(b, (r) => abrupt.push(r));
  b.destroy();
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(abrupt, ["stdin-close"]);
});

function start(extraArgs: string[]): { child: ChildProcess; stderr: () => string } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnm-stdin-"));
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
  // Keep the event loop alive like a real browser context would.
  env.NODE_OPTIONS = `--require ${path.join(root, "tests", "fixtures", "keepalive.cjs").replace(/\\/g, "/")}`;
  const child = spawn(
    process.execPath,
    [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts", ...extraArgs],
    { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] }
  );
  let err = "";
  child.stderr!.on("data", (d) => (err += d));
  child.stdout!.resume();
  return { child, stderr: () => err };
}

async function waitFor(cond: () => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return cond();
}

test("stdio server exits when the client closes stdin", async () => {
  const { child, stderr } = start([]);
  let exited: number | null | undefined;
  child.on("exit", (code) => (exited = code ?? -1));
  try {
    assert.ok(
      await waitFor(() => /connected via stdio/.test(stderr()), 30_000),
      "server did not start"
    );
    child.stdin!.end();
    assert.ok(
      await waitFor(() => exited !== undefined, 15_000),
      "server stayed alive after stdin EOF"
    );
    assert.equal(exited, 0);
  } finally {
    child.kill();
  }
});

test("http transport does NOT shut down on closed stdin", async () => {
  const { child, stderr } = start(["--transport", "http", "--port", "38917"]);
  let exited = false;
  child.on("exit", () => (exited = true));
  try {
    assert.ok(
      await waitFor(() => /Streamable HTTP/.test(stderr()), 30_000),
      "http server did not start"
    );
    child.stdin!.end();
    await new Promise((r) => setTimeout(r, 3000));
    assert.equal(exited, false, "http server wrongly shut down on stdin EOF");
  } finally {
    child.kill();
  }
});

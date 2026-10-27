import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const GOOD = `https://notebook.google.com/notebook/${ID}`;
const BAD = [
  `http://notebook.google.com/notebook/${ID}`,
  `https://evil.example/notebook/${ID}`,
  `https://user:pass@notebook.google.com/notebook/${ID}`,
  `https://notebook.google.com:8443/notebook/${ID}`,
  `https://notebooklm.google.com.evil.example/notebook/${ID}`,
];

let NotebookLibrary: typeof import("../src/library/notebook-library.js").NotebookLibrary;
let SessionManager: typeof import("../src/session/session-manager.js").SessionManager;
let launched = 0;

before(async () => {
  // Sandbox every data path so no real library/profile is touched.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnm-test-"));
  for (const k of [
    "LOCALAPPDATA",
    "APPDATA",
    "XDG_DATA_HOME",
    "XDG_CONFIG_HOME",
    "XDG_CACHE_HOME",
    "HOME",
    "USERPROFILE",
  ]) {
    process.env[k] = tmp;
  }
  NotebookLibrary = (await import("../src/library/notebook-library.js")).NotebookLibrary;
  SessionManager = (await import("../src/session/session-manager.js")).SessionManager;
  // Never launch a real browser, even if validation is missing.
  const { SharedContextManager } = await import("../src/session/shared-context-manager.js");
  SharedContextManager.prototype.getOrCreateContext = async () => {
    launched++;
    throw new Error("STUB: browser launch attempted");
  };
});

test("SessionManager.getOrCreateSession rejects bad URLs before any browser work", async () => {
  const sm = new SessionManager({} as never);
  for (const u of BAD) {
    await assert.rejects(
      () => sm.getOrCreateSession("s1", u),
      (e: Error) => !/STUB/.test(e.message) && /Notebook URL/.test(e.message),
      u
    );
  }
  assert.equal(launched, 0);
  await assert.rejects(() => sm.getOrCreateSession("s1", GOOD), /STUB/);
});

test("library add/update reject bad URLs", () => {
  const lib = new NotebookLibrary();
  for (const u of BAD) {
    assert.throws(
      () => lib.addNotebook({ url: u, name: "x", description: "d", topics: ["t"] }),
      /Notebook URL/,
      u
    );
  }
  const nb = lib.addNotebook({ url: GOOD, name: "ok", description: "d", topics: ["t"] });
  assert.equal(nb.url, GOOD);
  for (const u of BAD) {
    assert.throws(() => lib.updateNotebook({ id: nb.id, url: u }), /Notebook URL/, u);
  }
  assert.equal(lib.getNotebook(nb.id)?.url, GOOD);
});

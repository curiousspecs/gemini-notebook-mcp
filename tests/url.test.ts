import { test } from "node:test";
import assert from "node:assert/strict";
import { assertNotebookUrl } from "../src/gemini-notebook/url.js";

const ID = "123e4567-e89b-12d3-a456-426614174000";

test("accepts both real hosts", () => {
  assert.equal(
    assertNotebookUrl(`https://notebook.google.com/notebook/${ID}`),
    `https://notebook.google.com/notebook/${ID}`
  );
  assert.equal(
    assertNotebookUrl(`https://notebooklm.google.com/notebook/${ID}`),
    `https://notebooklm.google.com/notebook/${ID}`
  );
});

test("strips fragment and trims", () => {
  assert.equal(
    assertNotebookUrl(`  https://notebook.google.com/notebook/${ID}#x `),
    `https://notebook.google.com/notebook/${ID}`
  );
});

test("rejects bad urls", () => {
  const bad = [
    `http://notebook.google.com/notebook/${ID}`,
    `https://example.com/notebook/${ID}`,
    `https://user:pass@notebook.google.com/notebook/${ID}`,
    `https://user@notebook.google.com/notebook/${ID}`,
    `https://notebook.google.com:8443/notebook/${ID}`,
    `https://notebooklm.google.com.evil.example/notebook/${ID}`,
    `https://evil.example/notebooklm.google.com/notebook/${ID}`,
    `https://xnotebook.google.com/notebook/${ID}`,
    `https://notebook.google.com/`,
    `https://notebook.google.com/other/${ID}`,
    `javascript:alert(1)`,
    `file:///etc/passwd`,
    `not a url`,
    ``,
  ];
  for (const u of bad) {
    assert.throws(() => assertNotebookUrl(u), Error, u);
  }
  assert.throws(() => assertNotebookUrl(undefined));
});

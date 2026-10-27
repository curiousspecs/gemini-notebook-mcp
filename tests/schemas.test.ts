import { test } from "node:test";
import assert from "node:assert/strict";
import { parseToolArgs } from "../src/tools/schemas.js";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const HOST_A = `https://notebook.google.com/notebook/${ID}`;
const HOST_B = `https://notebooklm.google.com/notebook/${ID}`;

test("ask_question accepts valid args on both hosts", () => {
  assert.deepEqual(parseToolArgs("ask_question", { question: "hi", notebook_url: HOST_A }), {
    question: "hi",
    notebook_url: HOST_A,
  });
  assert.doesNotThrow(() =>
    parseToolArgs("ask_question", { question: "hi", notebook_url: HOST_B })
  );
});

test("ask_question rejects wrong types, empty question, bad enum, bad URL", () => {
  assert.throws(() => parseToolArgs("ask_question", {}), /Invalid arguments for ask_question/);
  assert.throws(() => parseToolArgs("ask_question", { question: 5 }), /question/);
  assert.throws(() => parseToolArgs("ask_question", { question: "  " }), /question/);
  assert.throws(
    () => parseToolArgs("ask_question", { question: "q", source_format: "xml" }),
    /source_format/
  );
  assert.throws(
    () => parseToolArgs("ask_question", { question: "q", notebook_url: "http://evil.example/x" }),
    /notebook_url/
  );
});

test("unknown keys are dropped, not rejected (no .strict())", () => {
  const out = parseToolArgs("ask_question", {
    question: "q",
    _meta: { progressToken: 1 },
    extra: 1,
  });
  assert.deepEqual(out, { question: "q" });
});

test("tools with no arguments accept undefined", () => {
  assert.deepEqual(parseToolArgs("get_health", undefined), {});
  assert.deepEqual(parseToolArgs("list_notebooks", { junk: 1 }), {});
});

test("add_notebook / update_notebook check url, topics", () => {
  const ok = { url: HOST_A, name: "n", description: "d", topics: ["t"] };
  assert.doesNotThrow(() => parseToolArgs("add_notebook", ok));
  assert.throws(
    () => parseToolArgs("add_notebook", { ...ok, url: "https://evil.example/" }),
    /url/
  );
  assert.throws(() => parseToolArgs("add_notebook", { ...ok, topics: [] }), /topics/);
  assert.doesNotThrow(() => parseToolArgs("update_notebook", { id: "x", topics: [] }));
  assert.throws(
    () =>
      parseToolArgs("update_notebook", {
        id: "x",
        url: `http://notebook.google.com/notebook/${ID}`,
      }),
    /url/
  );
});

test("add_source, audio and cleanup schemas", () => {
  assert.throws(() => parseToolArgs("add_source", { type: "file", content: "x" }), /type/);
  assert.throws(() => parseToolArgs("add_source", { type: "url" }), /content/);
  assert.throws(() => parseToolArgs("generate_audio", { timeout_ms: -1 }), /timeout_ms/);
  assert.throws(() => parseToolArgs("download_audio", {}), /destination_dir/);
  assert.throws(() => parseToolArgs("cleanup_data", {}), /confirm/);
  assert.doesNotThrow(() => parseToolArgs("cleanup_data", { confirm: false }));
});

test("unknown tool passes through", () => {
  assert.deepEqual(parseToolArgs("nope", { a: 1 }), { a: 1 });
});

/**
 * Runtime argument schemas for MCP tools.
 *
 * Idea from upstream PR #64 ("Harden tool args and scoped config", author
 * CharlieCardenasToledo, MIT), adapted: URL checks go through the shared
 * assertNotebookUrl (both Google hosts, https only), and the schemas are NOT
 * .strict(): unknown keys are dropped, not rejected, so client extras such as
 * `_meta` inside `arguments` keep working.
 */

import { z } from "zod";
import { assertNotebookUrl } from "../gemini-notebook/url.js";

const nonEmpty = z.string().trim().min(1);

/** Optional notebook URL; an empty string counts as absent. */
const notebookUrl = z
  .string()
  .trim()
  .optional()
  .superRefine((value, ctx) => {
    if (!value) return;
    try {
      assertNotebookUrl(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Invalid notebook URL",
      });
    }
  });

const requiredNotebookUrl = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    try {
      assertNotebookUrl(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Invalid notebook URL",
      });
    }
  });

const timeout = z.number().int().positive();

const browserOptions = z
  .object({
    show: z.boolean().optional(),
    headless: z.boolean().optional(),
    timeout_ms: timeout.optional(),
    stealth: z
      .object({
        enabled: z.boolean().optional(),
        random_delays: z.boolean().optional(),
        human_typing: z.boolean().optional(),
        mouse_movements: z.boolean().optional(),
        typing_wpm_min: z.number().positive().optional(),
        typing_wpm_max: z.number().positive().optional(),
        delay_min_ms: z.number().nonnegative().optional(),
        delay_max_ms: z.number().nonnegative().optional(),
      })
      .optional(),
    viewport: z
      .object({
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      })
      .optional(),
  })
  .optional();

const target = {
  session_id: z.string().optional(),
  notebook_id: z.string().optional(),
  notebook_url: notebookUrl,
  show_browser: z.boolean().optional(),
};

const stringList = z.array(nonEmpty);

export const TOOL_SCHEMAS: Record<string, z.ZodTypeAny> = {
  ask_question: z.object({
    question: nonEmpty,
    ...target,
    browser_options: browserOptions,
    source_format: z.enum(["none", "inline", "footnotes", "json"]).optional(),
  }),
  add_notebook: z.object({
    url: requiredNotebookUrl,
    name: nonEmpty,
    description: nonEmpty,
    topics: stringList.min(1),
    content_types: stringList.optional(),
    use_cases: stringList.optional(),
    tags: stringList.optional(),
  }),
  list_notebooks: z.object({}),
  get_notebook: z.object({ id: nonEmpty }),
  select_notebook: z.object({ id: nonEmpty }),
  update_notebook: z.object({
    id: nonEmpty,
    name: nonEmpty.optional(),
    description: nonEmpty.optional(),
    topics: stringList.optional(),
    content_types: stringList.optional(),
    use_cases: stringList.optional(),
    tags: stringList.optional(),
    url: notebookUrl,
  }),
  remove_notebook: z.object({ id: nonEmpty }),
  search_notebooks: z.object({ query: nonEmpty }),
  get_library_stats: z.object({}),
  list_sessions: z.object({}),
  close_session: z.object({ session_id: nonEmpty }),
  reset_session: z.object({ session_id: nonEmpty }),
  get_health: z.object({}),
  setup_auth: z.object({
    show_browser: z.boolean().optional(),
    browser_options: browserOptions,
  }),
  re_auth: z.object({
    show_browser: z.boolean().optional(),
    browser_options: browserOptions,
  }),
  cleanup_data: z.object({
    confirm: z.boolean(),
    preserve_library: z.boolean().optional(),
  }),
  add_source: z.object({
    type: z.enum(["url", "text"]),
    content: nonEmpty,
    title: z.string().optional(),
    ...target,
  }),
  generate_audio: z.object({
    custom_prompt: z.string().optional(),
    timeout_ms: timeout.optional(),
    wait_for_completion: z.boolean().optional(),
    ...target,
  }),
  get_audio_status: z.object({ ...target }),
  download_audio: z.object({
    destination_dir: nonEmpty,
    ...target,
  }),
};

/**
 * Validate and normalise the arguments of a tool call.
 * Tools without a schema (unknown names) pass through unchanged.
 * Throws an Error("Invalid arguments for <tool>: ...") on failure.
 */
export function parseToolArgs(name: string, args: unknown): unknown {
  const schema = TOOL_SCHEMAS[name];
  if (!schema) return args;
  const result = schema.safeParse(args ?? {});
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid arguments for ${name}: ${detail}`);
  }
  return result.data;
}

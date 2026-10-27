/**
 * Notebook URL validation.
 *
 * One chokepoint for every URL that may become a browser navigation target.
 * Idea from PR #77 (src/notebooklm/url.ts) on the upstream repo, tightened:
 * https only, exact host allowlist, /notebook/<id> path, and no credentials
 * or explicit port.
 */

export const ALLOWED_NOTEBOOK_HOSTS: readonly string[] = [
  "notebook.google.com",
  "notebooklm.google.com",
];

const NOTEBOOK_PATH = /^\/notebook\/[a-zA-Z0-9_-]+\/?$/;

/**
 * Validate a notebook URL and return it normalised (trimmed, fragment removed).
 * Throws an Error with a short reason on any violation.
 */
export function assertNotebookUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Notebook URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Notebook URL must be an absolute URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Notebook URL must use https");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error("Notebook URL must not contain credentials");
  }
  if (parsed.port !== "") {
    throw new Error("Notebook URL must not specify a port");
  }
  if (!ALLOWED_NOTEBOOK_HOSTS.includes(parsed.hostname.toLowerCase())) {
    throw new Error(`Notebook URL host must be one of: ${ALLOWED_NOTEBOOK_HOSTS.join(", ")}`);
  }
  if (!NOTEBOOK_PATH.test(parsed.pathname)) {
    throw new Error("Notebook URL path must look like /notebook/<id>");
  }

  parsed.hash = "";
  return parsed.toString();
}

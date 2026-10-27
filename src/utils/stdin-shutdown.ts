/**
 * Detect that the MCP client has gone away (stdio transport only).
 *
 * MCP clients disconnect by closing the stdio pipe, not by sending a signal,
 * and a live browser context keeps the Node event loop alive, so without this
 * the server (and its Chrome) would be orphaned. Idea from upstream PR #47
 * (author altristech2025, MIT).
 *
 * "end" is a clean EOF; "close" is an abrupt fd close. Callers must make the
 * callback idempotent (the shutdown path is) because both can fire.
 */
export function watchStdinClose(
  stdin: NodeJS.ReadableStream,
  onClosed: (reason: "stdin-end" | "stdin-close") => void
): void {
  stdin.on("end", () => onClosed("stdin-end"));
  stdin.on("close", () => onClosed("stdin-close"));
}

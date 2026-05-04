import { z } from "zod";
import { upsertFrontend } from "../state/store.js";

const FieldSchema = z.object({
  name: z.string().describe("Field name or identifier (e.g. 'customerEmail')"),
  type: z
    .string()
    .describe("TypeScript/inferred data type (string, number, boolean, Date, any)"),
  action: z
    .string()
    .optional()
    .describe(
      "Associated event or action (submit, click, change, conditional, etc.)"
    ),
});

/**
 * Registers the upsert_frontend_schema tool on the MCP server instance.
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 */
export function registerFrontendTools(server) {
  server.tool(
    "upsert_frontend_schema",
    "Registers or updates the schema mapping of an Angular screen/component inside mcp-OmniMatch. " +
      "Call this after extracting form fields, bindings, and user actions from .html and .ts source files. " +
      "Repeated calls with the same screen_id overwrite the previous entry.",
    {
      screen_id: z
        .string()
        .describe(
          "Unique identifier for the Angular screen or component (e.g. 'customer-registration', 'login-screen')"
        ),
      elements: z
        .array(FieldSchema)
        .min(1)
        .describe("Array of UI elements extracted from the Angular template"),
    },
    async ({ screen_id, elements }) => {
      upsertFrontend(screen_id, elements);

      return {
        content: [
          {
            type: "text",
            text:
              `[mcp-OmniMatch] Frontend schema for '${screen_id}' stored successfully. ` +
              `${elements.length} element(s) registered.\n\n` +
              `Stored fields:\n` +
              elements
                .map(
                  (e) =>
                    `  • ${e.name} (${e.type})${e.action ? ` → ${e.action}` : ""}`
                )
                .join("\n"),
          },
        ],
      };
    }
  );
}

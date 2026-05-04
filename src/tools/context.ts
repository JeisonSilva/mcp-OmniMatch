import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getFullContext, clearContext } from "../state/store.ts";
import { ANGULAR_MAPPING_GUIDE, DOTNET_MAPPING_GUIDE } from "../prompts/guides.ts";

export function registerContextTools(server: McpServer): void {
  server.tool(
    "get_full_context",
    "Retrieves the complete current state of all registered frontend and backend schemas stored in mcp-OmniMatch. " +
      "Call this before performing the final compatibility analysis between Angular screens and .NET endpoints. " +
      "The returned JSON contains the full frontend_map and backend_map.",
    {},
    async () => {
      const context = getFullContext();
      const frontendCount = Object.keys(context.frontend_map).length;
      const backendCount = Object.keys(context.backend_map).length;

      if (frontendCount === 0 && backendCount === 0) {
        return {
          content: [
            {
              type: "text",
              text:
                "[mcp-OmniMatch] The context store is empty.\n" +
                "Use generate_mapping_prompt to get extraction instructions, then call " +
                "upsert_frontend_schema and upsert_backend_schema to populate it.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                _summary: { frontend_screens: frontendCount, backend_controllers: backendCount },
                ...context,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "generate_mapping_prompt",
    "Returns a detailed instructional guide on how to extract and map schema information from Angular or .NET source files. " +
      "Call this first before asking the user to paste source code, so the LLM knows exactly what to look for and how to call the storage tools.",
    {
      type: z
        .enum(["angular", "dotnet"])
        .describe(
          "The type of source file to be mapped: 'angular' for .ts/.html components, 'dotnet' for C# controllers"
        ),
    },
    async ({ type }) => {
      const guide = type === "angular" ? ANGULAR_MAPPING_GUIDE : DOTNET_MAPPING_GUIDE;
      return { content: [{ type: "text", text: guide }] };
    }
  );

  server.tool(
    "clear_context",
    "Resets the mcp-OmniMatch context store, removing all stored frontend and backend schemas. " +
      "Use this to start a fresh analysis session without restarting the server.",
    {},
    async () => {
      clearContext();
      return {
        content: [
          { type: "text", text: "[mcp-OmniMatch] Context store cleared. All schemas removed." },
        ],
      };
    }
  );
}

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { upsertBackend } from "../state/store.ts";

const RouteSchema = z.object({
  path: z.string().describe("Full API route path (e.g. '/api/customers/{id}')"),
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
    .describe("HTTP method"),
  request: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Request body / query fields as { fieldName: csharpType } (omit for GET/DELETE without body)"
    ),
  response: z
    .record(z.string(), z.string())
    .optional()
    .describe("Response body fields as { fieldName: csharpType }"),
  statusCodes: z
    .array(z.number().int().min(100).max(599))
    .optional()
    .describe("All HTTP status codes this endpoint can return (e.g. [200, 201, 400, 404])"),
});

export function registerBackendTools(server: McpServer): void {
  server.tool(
    "upsert_backend_schema",
    "Registers or updates the schema mapping of a .NET Web API controller inside mcp-OmniMatch. " +
      "Call this after extracting HTTP action methods, DTOs, and route templates from C# controller files. " +
      "Repeated calls with the same controller_id overwrite the previous entry.",
    {
      controller_id: z
        .string()
        .describe("Unique identifier for the .NET controller (e.g. 'CustomerController')"),
      routes: z
        .array(RouteSchema)
        .min(1)
        .describe("Array of API routes/endpoints extracted from the C# controller"),
    },
    async ({ controller_id, routes }) => {
      upsertBackend(controller_id, routes);

      return {
        content: [
          {
            type: "text",
            text:
              `[mcp-OmniMatch] Backend schema for '${controller_id}' stored successfully. ` +
              `${routes.length} route(s) registered.\n\n` +
              `Stored routes:\n` +
              routes
                .map(
                  (r) =>
                    `  • ${r.method} ${r.path}` +
                    (r.statusCodes?.length ? ` [${r.statusCodes.join(", ")}]` : "")
                )
                .join("\n"),
          },
        ],
      };
    }
  );
}

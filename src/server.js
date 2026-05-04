#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerFrontendTools } from "./tools/frontend.js";
import { registerBackendTools } from "./tools/backend.js";
import { registerContextTools } from "./tools/context.js";

const server = new McpServer({
  name: "mcp-OmniMatch",
  version: "1.0.0",
});

registerFrontendTools(server);
registerBackendTools(server);
registerContextTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);

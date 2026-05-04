/**
 * ContextStore — the single source of truth for mcp-OmniMatch.
 *
 * Keeps all extracted schemas in memory across multiple LLM tool calls so the
 * model can accumulate frontend + backend mappings before running the final
 * compatibility analysis, without relying on conversation-level memory.
 */

const store = {
  /** @type {Record<string, { screen_name: string, fields: Array<{name:string,type:string,action?:string}> }>} */
  frontend_map: {},

  /** @type {Record<string, { controller: string, endpoints: Array<{path:string,method:string,request?:object,response?:object,statusCodes?:number[]}> }>} */
  backend_map: {},
};

export function upsertFrontend(screenId, elements) {
  store.frontend_map[screenId] = { screen_name: screenId, fields: elements };
}

export function upsertBackend(controllerId, routes) {
  store.backend_map[controllerId] = { controller: controllerId, endpoints: routes };
}

export function getFullContext() {
  return structuredClone(store);
}

export function clearContext() {
  store.frontend_map = {};
  store.backend_map = {};
}

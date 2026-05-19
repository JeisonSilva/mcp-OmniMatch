# mcp-OmniMatch

**MCP Integration Orchestrator** — transforms Claude / Cursor into an integration engineer that maps Angular screens to .NET Web API endpoints and evaluates their compatibility.

> Zero LLM cost. The model does the reasoning; mcp-OmniMatch holds the state.

---

## How it works

```
User pastes Angular HTML/TS  ──▶  LLM extracts schema  ──▶  upsert_frontend_schema
User pastes C# controller    ──▶  LLM extracts schema  ──▶  upsert_backend_schema
                                                               │
                                                        ContextStore (in-memory)
                                                               │
                              ◀──  get_full_context  ◀────────┘
                                        │
                              LLM performs compatibility analysis
                                        │
                              Compatibility report + integration guide
```

The MCP server is a **stateful middleware**: it accumulates extracted schemas across multiple tool calls so the LLM can perform a meaningful cross-schema analysis without hitting context limits or relying on conversation memory.

---

## Tools

| Tool | Descrição |
|---|---|
| `generate_mapping_prompt` | Retorna o guia de extração passo a passo para arquivos Angular ou .NET. Chame primeiro. |
| `upsert_frontend_schema` | Armazena/atualiza o mapa de campos de uma tela Angular. |
| `upsert_backend_schema` | Armazena/atualiza o mapa de rotas de um controller .NET. |
| `get_full_context` | Retorna o estado completo (frontend + backend) para a análise final. |
| `gerar_relatorio` | Gera `relatorio-compatibilidade.md` e `plano-integracao.md` a partir da análise da LLM. |
| `clear_context` | Limpa o store para iniciar uma nova sessão sem reiniciar o servidor. |

---

## Compatibility checks the LLM performs

After `get_full_context`, instruct the model to evaluate:

- **Type alignment** — `string` (C#) vs `string` (TS) → 100 %. `decimal` vs `number` → verify precision.
- **Naming conventions** — `customer_id` (snake_case) vs `customerId` (camelCase) → serialization warning.
- **Missing fields** — "The screen sends `birthDate` but no endpoint DTO accepts it."
- **HTTP status handling** — "The API returns `201 Created` on POST; does the Angular service check for 201 or only 200?"
- **Nullable mismatches** — C# `string?` not null-checked on the Angular side.
- **Extra fields** — "The API response contains `internalAuditId`; the screen never reads it."

---

## Project structure

```
mcp-OmniMatch/
├── src/
│   ├── server.ts               # Entry point MCP (StdioTransport)
│   ├── tools/
│   │   ├── frontend.ts         # upsert_frontend_schema
│   │   ├── backend.ts          # upsert_backend_schema
│   │   ├── context.ts          # get_full_context · generate_mapping_prompt · clear_context
│   │   └── reports.ts          # gerar_relatorio → dois arquivos Markdown
│   ├── state/
│   │   └── store.ts            # ContextStore SQLite + interfaces de domínio
│   └── prompts/
│       └── guides.ts           # Guias de extração (pt-BR)
├── data/
│   └── omnimatch.db            # Banco SQLite (criado automaticamente, git-ignored)
├── reports/                    # Relatórios gerados (git-ignored)
│   ├── relatorio-compatibilidade-YYYY-MM-DD.md
│   └── plano-integracao-YYYY-MM-DD.md
├── tsconfig.json               # Apenas para editor/IDE (noEmit — Node 24 roda .ts direto)
├── claude_desktop_config.example.json
├── package.json
└── README.md
```

> **Runtime:** Node.js 24+ runs `.ts` files natively without compilation. No `tsc`, no build step.  
> `tsconfig.json` exists only for IDE type-checking (`noEmit: true`).

---

## Installation

```bash
git clone https://github.com/jeisonsilva/mcp-OmniMatch.git
cd mcp-OmniMatch
npm install
```

---

## Claude Desktop configuration

Copy `claude_desktop_config.example.json` and merge it into your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-OmniMatch": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-OmniMatch/src/server.ts"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

Restart Claude Desktop. The five mcp-OmniMatch tools will appear in the tool list.

---

## Cursor configuration

Add to `.cursor/mcp.json` in your project root (or the global `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "mcp-OmniMatch": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-OmniMatch/src/server.ts"]
    }
  }
}
```

---

## Typical session

```
You: Use mcp-OmniMatch to help me check if my login screen matches the auth API.

Claude: I'll start by fetching the extraction guides.
  → generate_mapping_prompt({ type: "angular" })
  → [guide returned]

  Paste your Angular login component (HTML + TS).

You: [pastes LoginComponent.html and login.component.ts]

Claude: Extracting fields…
  → upsert_frontend_schema({ screen_id: "login-screen", elements: [...] })

  Now paste your C# AuthController.

You: [pastes AuthController.cs]

Claude: Extracting endpoints…
  → generate_mapping_prompt({ type: "dotnet" })
  → upsert_backend_schema({ controller_id: "AuthController", routes: [...] })

  Running compatibility analysis…
  → get_full_context()

  ## Compatibility Report — login-screen × AuthController

  | Field       | Frontend type | Backend type | Status  |
  |-------------|---------------|--------------|---------|
  | email       | string        | string       | ✅ OK   |
  | password    | string        | string       | ✅ OK   |
  | rememberMe  | boolean       | —            | ⚠️ Not in DTO |

  POST /api/auth/login returns 200 — Angular service checks for 200. ✅
  No birthDate field mismatch detected.
```

---

## Known limitations

- **Not a live watcher** — mcp-OmniMatch does not detect file changes automatically. Re-run `upsert_*` tools after editing source files.
- **ReactiveForm depth** — complex nested `FormGroup` hierarchies may be partially captured if the LLM misses nested `formControlName` bindings. The Angular extraction guide instructs the model to look for these explicitly.
- **External DTOs** — if a C# DTO is defined in a separate file that is not provided, the tool records it as `"<ExternalDto>"`. Provide both files for full analysis.
- **Persistência entre reinicializações** — schemas armazenados em `data/omnimatch.db` (SQLite, WAL). Use `clear_context` para iniciar nova sessão.
- **Caminho do banco configurável** — variável `OMNIMATCH_DB_PATH` redireciona o arquivo `.db` para outro local.
- **Caminho dos relatórios configurável** — variável `OMNIMATCH_REPORTS_PATH` define onde os arquivos Markdown serão salvos (padrão: `reports/` na raiz do projeto). O parâmetro `diretorio_saida` da ferramenta sobrepõe a variável por chamada.

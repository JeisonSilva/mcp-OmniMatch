import { z } from "zod";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ── Diretório de saída padrão ──────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..");

const DEFAULT_REPORTS_DIR = process.env.OMNIMATCH_REPORTS_PATH
  ? resolve(process.env.OMNIMATCH_REPORTS_PATH)
  : resolve(PROJECT_ROOT, "reports");

// ── Schemas Zod ───────────────────────────────────────────────────────────

const CampoSchema = z.object({
  nome: z.string().describe("Nome do campo (ex.: 'cpf', 'dataNascimento')"),
  tipo_frontend: z.string().describe("Tipo TypeScript no Angular (ex.: 'string', 'Date')"),
  tipo_backend: z.string().describe("Tipo C# no .NET (ex.: 'string', 'DateTime'). Use '—' se ausente."),
  status: z
    .enum(["compativel", "aviso", "ausente_backend", "ausente_frontend"])
    .describe(
      "compativel = tipos equivalentes; aviso = convenção/precisão; " +
      "ausente_backend = campo existe no front mas não no DTO; " +
      "ausente_frontend = campo existe no DTO mas não é tratado no front"
    ),
  detalhe: z.string().optional().describe("Observação livre (ex.: 'PascalCase vs camelCase')"),
});

const RotaSchema = z.object({
  metodo: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  caminho: z.string().describe("Caminho da rota (ex.: '/api/clientes/{id}')"),
  status: z
    .enum(["compativel", "ausente", "parcial"])
    .describe(
      "compativel = front trata corretamente; ausente = front não consome esta rota; " +
      "parcial = consome mas com lacunas (ex.: status code ignorado)"
    ),
  detalhe: z.string().optional(),
});

const MapeamentoSchema = z.object({
  tela: z.string().describe("screen_id da tela Angular (ex.: 'cadastro-cliente')"),
  controller: z.string().describe("controller_id do .NET (ex.: 'ClienteController')"),
  campos: z.array(CampoSchema).describe("Análise campo a campo entre tela e DTO"),
  rotas: z.array(RotaSchema).optional().describe("Análise rota a rota"),
});

const AcaoSchema = z.object({
  descricao: z
    .string()
    .describe("O que deve ser feito (ex.: 'Adicionar campo cpf ao DTO ClienteRequestDto')"),
  camada: z
    .enum(["frontend", "backend", "ambos"])
    .describe("Onde a mudança precisa ocorrer"),
  prioridade: z
    .enum(["alta", "media", "baixa"])
    .describe("alta = bloqueia integração; media = funcional mas incompleto; baixa = melhoria"),
  tipo: z
    .enum(["criar", "modificar", "remover"])
    .describe("Natureza da mudança"),
  arquivo_sugerido: z
    .string()
    .optional()
    .describe("Arquivo ou classe sugerida para a mudança (ex.: 'ClienteRequestDto.cs')"),
});

// ── Helpers de formatação ─────────────────────────────────────────────────

function dataHoje(): string {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function slugData(): string {
  return new Date().toISOString().slice(0, 10);
}

function iconeCampo(status: string): string {
  return (
    { compativel: "✅", aviso: "⚠️", ausente_backend: "❌", ausente_frontend: "🔷" }[status] ?? "❓"
  );
}

function iconeRota(status: string): string {
  return { compativel: "✅", parcial: "⚠️", ausente: "❌" }[status] ?? "❓";
}

function iconePrioridade(p: string): string {
  return { alta: "🔴", media: "🟡", baixa: "🟢" }[p] ?? "⚪";
}

function iconeAcao(tipo: string): string {
  return { criar: "➕", modificar: "✏️", remover: "🗑️" }[tipo] ?? "🔧";
}

function barraProgresso(pct: number): string {
  const filled = Math.round(pct / 5);
  return `[${"█".repeat(filled)}${"░".repeat(20 - filled)}] ${pct}%`;
}

// ── Gerador: Relatório de Compatibilidade ─────────────────────────────────

function gerarRelatorio(
  titulo: string,
  percentual: number,
  mapeamentos: z.infer<typeof MapeamentoSchema>[],
  acoes: z.infer<typeof AcaoSchema>[]
): string {
  const totalCampos = mapeamentos.flatMap((m) => m.campos).length;
  const compativeis = mapeamentos
    .flatMap((m) => m.campos)
    .filter((c) => c.status === "compativel").length;
  const avisos = mapeamentos
    .flatMap((m) => m.campos)
    .filter((c) => c.status === "aviso").length;
  const ausentes = mapeamentos
    .flatMap((m) => m.campos)
    .filter((c) => c.status === "ausente_backend" || c.status === "ausente_frontend").length;

  const linhas: string[] = [];

  linhas.push(`# Relatório de Compatibilidade — ${titulo}`);
  linhas.push(`> Gerado por **mcp-OmniMatch** em ${dataHoje()}`);
  linhas.push("");

  // Resumo executivo
  linhas.push("## Resumo Executivo");
  linhas.push("");
  linhas.push(`**Compatibilidade geral:** ${barraProgresso(percentual)}`);
  linhas.push("");
  linhas.push("| Indicador | Valor |");
  linhas.push("|-----------|-------|");
  linhas.push(`| Telas analisadas | ${mapeamentos.length} |`);
  linhas.push(
    `| Controllers analisados | ${new Set(mapeamentos.map((m) => m.controller)).size} |`
  );
  linhas.push(`| Total de campos comparados | ${totalCampos} |`);
  linhas.push(`| ✅ Compatíveis | ${compativeis} |`);
  linhas.push(`| ⚠️ Avisos | ${avisos} |`);
  linhas.push(`| ❌ Ausentes / Incompatíveis | ${ausentes} |`);
  linhas.push(`| Ações necessárias | ${acoes.length} |`);
  linhas.push("");

  // Análise por mapeamento
  linhas.push("---");
  linhas.push("");
  linhas.push("## Análise Detalhada");

  for (const m of mapeamentos) {
    linhas.push("");
    linhas.push(`### 🖥️ \`${m.tela}\` × \`${m.controller}\``);
    linhas.push("");

    // Campos
    linhas.push("#### Campos");
    linhas.push("");
    linhas.push("| Status | Campo | Tipo Frontend | Tipo Backend | Observação |");
    linhas.push("|--------|-------|---------------|--------------|------------|");

    for (const c of m.campos) {
      linhas.push(
        `| ${iconeCampo(c.status)} | \`${c.nome}\` | \`${c.tipo_frontend}\` | \`${c.tipo_backend}\` | ${c.detalhe ?? "—"} |`
      );
    }

    // Rotas
    if (m.rotas && m.rotas.length > 0) {
      linhas.push("");
      linhas.push("#### Rotas");
      linhas.push("");
      linhas.push("| Status | Método | Caminho | Observação |");
      linhas.push("|--------|--------|---------|------------|");

      for (const r of m.rotas) {
        linhas.push(
          `| ${iconeRota(r.status)} | \`${r.metodo}\` | \`${r.caminho}\` | ${r.detalhe ?? "—"} |`
        );
      }
    }
  }

  // O que falta
  linhas.push("");
  linhas.push("---");
  linhas.push("");
  linhas.push("## O que Falta Integrar");
  linhas.push("");

  const ausentes_lista = mapeamentos
    .flatMap((m) =>
      m.campos
        .filter((c) => c.status !== "compativel")
        .map((c) => ({ mapeamento: `${m.tela} × ${m.controller}`, campo: c }))
    );

  if (ausentes_lista.length === 0) {
    linhas.push("Nenhuma pendência identificada. Integração 100% compatível.");
  } else {
    for (const item of ausentes_lista) {
      const icone = iconeCampo(item.campo.status);
      const label =
        {
          aviso: "Aviso de compatibilidade",
          ausente_backend: "Ausente no backend",
          ausente_frontend: "Ausente no frontend",
        }[item.campo.status] ?? "";

      linhas.push(
        `- ${icone} **\`${item.campo.nome}\`** (${item.mapeamento}) — ${label}${item.campo.detalhe ? `: ${item.campo.detalhe}` : ""}`
      );
    }
  }

  // Legenda
  linhas.push("");
  linhas.push("---");
  linhas.push("");
  linhas.push("## Legenda");
  linhas.push("");
  linhas.push("| Símbolo | Significado |");
  linhas.push("|---------|-------------|");
  linhas.push("| ✅ | Tipos equivalentes, integração sem ajustes |");
  linhas.push("| ⚠️ | Compatível com ressalva (convenção de nome, precisão numérica, etc.) |");
  linhas.push("| ❌ | Campo presente no frontend mas ausente no DTO do backend |");
  linhas.push("| 🔷 | Campo presente no backend mas não tratado pelo frontend |");

  return linhas.join("\n");
}

// ── Gerador: Plano de Integração ──────────────────────────────────────────

function gerarPlano(
  titulo: string,
  percentual: number,
  acoes: z.infer<typeof AcaoSchema>[]
): string {
  const porPrioridade = {
    alta: acoes.filter((a) => a.prioridade === "alta"),
    media: acoes.filter((a) => a.prioridade === "media"),
    baixa: acoes.filter((a) => a.prioridade === "baixa"),
  };

  const linhas: string[] = [];

  linhas.push(`# Plano de Integração — ${titulo}`);
  linhas.push(`> Gerado por **mcp-OmniMatch** em ${dataHoje()}`);
  linhas.push("");
  linhas.push(
    `Este plano define as tarefas necessárias para elevar a compatibilidade da integração ` +
    `Angular ↔ .NET de **${percentual}%** para **100%**.`
  );
  linhas.push("");

  // Resumo
  linhas.push("## Resumo do Backlog");
  linhas.push("");
  linhas.push("| Prioridade | Qtd | Camada |");
  linhas.push("|------------|-----|--------|");

  for (const [prioridade, lista] of Object.entries(porPrioridade)) {
    if (lista.length === 0) continue;
    const camadas = [...new Set(lista.map((a) => a.camada))].join(", ");
    linhas.push(
      `| ${iconePrioridade(prioridade)} ${prioridade.charAt(0).toUpperCase() + prioridade.slice(1)} | ${lista.length} | ${camadas} |`
    );
  }

  linhas.push("");

  // Backlog por prioridade
  linhas.push("---");
  linhas.push("");
  linhas.push("## Backlog de Integração");

  const secoes: [string, z.infer<typeof AcaoSchema>[]][] = [
    ["🔴 Alta Prioridade", porPrioridade.alta],
    ["🟡 Média Prioridade", porPrioridade.media],
    ["🟢 Baixa Prioridade", porPrioridade.baixa],
  ];

  for (const [titulo_secao, lista] of secoes) {
    if (lista.length === 0) continue;

    linhas.push("");
    linhas.push(`### ${titulo_secao}`);
    linhas.push("");

    lista.forEach((acao, i) => {
      linhas.push(
        `#### ${iconeAcao(acao.tipo)} Tarefa ${i + 1}: ${acao.descricao}`
      );
      linhas.push("");
      linhas.push(`- **Tipo:** ${acao.tipo}`);
      linhas.push(`- **Camada:** ${acao.camada}`);

      if (acao.arquivo_sugerido) {
        linhas.push(`- **Arquivo:** \`${acao.arquivo_sugerido}\``);
      }

      linhas.push("");
    });
  }

  // Checklist de entrega
  linhas.push("---");
  linhas.push("");
  linhas.push("## Checklist de Entrega");
  linhas.push("");
  linhas.push(
    "Use esta lista para acompanhar o progresso. Após concluir cada tarefa, " +
    "re-execute a análise com `get_full_context` para validar a evolução."
  );
  linhas.push("");

  for (const [, lista] of secoes) {
    for (const acao of lista) {
      linhas.push(`- [ ] ${iconeAcao(acao.tipo)} **[${acao.camada.toUpperCase()}]** ${acao.descricao}`);
    }
  }

  linhas.push("");
  linhas.push("---");
  linhas.push("");
  linhas.push("## Próximos Passos");
  linhas.push("");
  linhas.push("1. Priorize as tarefas de **Alta Prioridade** — elas bloqueiam a integração básica.");
  linhas.push("2. Após cada tarefa concluída, atualize o schema com `upsert_frontend_schema` ou `upsert_backend_schema`.");
  linhas.push("3. Re-execute `get_full_context` e solicite nova análise de compatibilidade.");
  linhas.push("4. Gere um novo relatório com `gerar_relatorio` para comparar a evolução.");

  return linhas.join("\n");
}

// ── Registro da ferramenta ────────────────────────────────────────────────

export function registerReportTools(server: McpServer): void {
  server.tool(
    "gerar_relatorio",
    "Gera dois arquivos Markdown a partir da análise de compatibilidade: " +
      "(1) relatorio-compatibilidade.md com o percentual e o detalhamento campo a campo; " +
      "(2) plano-integracao.md com o backlog priorizado de tarefas para atingir 100% de compatibilidade. " +
      "Chame esta ferramenta após executar get_full_context e realizar a análise completa.",
    {
      titulo: z
        .string()
        .describe("Nome do projeto ou da análise (ex.: 'Portal do Cliente v2')"),
      percentual_compatibilidade: z
        .number()
        .min(0)
        .max(100)
        .describe("Percentual geral de compatibilidade calculado (0 a 100)"),
      mapeamentos: z
        .array(MapeamentoSchema)
        .min(1)
        .describe("Lista de comparações tela × controller com análise campo a campo"),
      acoes: z
        .array(AcaoSchema)
        .describe(
          "Lista de tarefas necessárias para atingir 100% de compatibilidade. " +
          "Pode ser vazia se a compatibilidade já for total."
        ),
      diretorio_saida: z
        .string()
        .optional()
        .describe(
          "Caminho absoluto do diretório onde os arquivos serão salvos. " +
          `Padrão: ${DEFAULT_REPORTS_DIR}`
        ),
    },
    async ({ titulo, percentual_compatibilidade, mapeamentos, acoes, diretorio_saida }) => {
      const outDir = diretorio_saida ? resolve(diretorio_saida) : DEFAULT_REPORTS_DIR;

      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }

      const slug = slugData();
      const relatorioPath = resolve(outDir, `relatorio-compatibilidade-${slug}.md`);
      const planoPath = resolve(outDir, `plano-integracao-${slug}.md`);

      const relatorio = gerarRelatorio(titulo, percentual_compatibilidade, mapeamentos, acoes);
      const plano = gerarPlano(titulo, percentual_compatibilidade, acoes);

      writeFileSync(relatorioPath, relatorio, "utf-8");
      writeFileSync(planoPath, plano, "utf-8");

      return {
        content: [
          {
            type: "text",
            text:
              `[mcp-OmniMatch] Relatórios gerados com sucesso!\n\n` +
              `📊 **Relatório de Compatibilidade:**\n   ${relatorioPath}\n\n` +
              `📋 **Plano de Integração:**\n   ${planoPath}\n\n` +
              `Compatibilidade geral: **${percentual_compatibilidade}%** | ` +
              `Ações pendentes: **${acoes.length}**`,
          },
        ],
      };
    }
  );
}

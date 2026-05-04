export const ANGULAR_MAPPING_GUIDE = `
# mcp-OmniMatch — Guia de Extração Angular

Você está prestes a ler um componente Angular (.ts) e seu template (.html).
Siga estes passos **exatamente** e chame \`upsert_frontend_schema\` com o resultado.

## Passo 1 — Identificar a tela
Use o nome da classe do componente ou o caminho da rota como \`screen_id\`
(ex.: \`cadastro-cliente\`, \`tela-login\`).

## Passo 2 — Extrair todos os campos vinculados
Procure pelos seguintes padrões no template e na classe do componente:

| Padrão no código                        | O que capturar                  |
|-----------------------------------------|---------------------------------|
| \`[(ngModel)]="nomeCampo"\`             | Binding bidirecional → campo    |
| \`formControlName="nomeCampo"\`         | Controle de formulário reativo  |
| \`[value]="expr"\` / \`(change)="fn()"\`| Binding unidirecional + evento  |
| \`*ngFor="let item of lista"\`          | Campo de coleção                |
| \`<button (click)="fn()">\`             | Elemento de ação                |

## Passo 3 — Inferir o tipo TypeScript
Verifique na classe do componente a declaração da propriedade ou a definição do FormBuilder.
Se não encontrar, infira pelo contexto:
- \`email\`, \`senha\`, \`nome\` → \`string\`
- \`idade\`, \`quantidade\`, \`preco\` → \`number\`
- \`ativo\`, \`marcado\`, \`isAdmin\` → \`boolean\`
- campos de data → \`Date\`
- desconhecido → \`any\`

## Passo 4 — Identificar as ações
Para cada binding \`(click)\`, \`(submit)\`, \`(change)\`, registre:
- o nome do evento (ex.: \`submit\`, \`click\`)
- o nome do método handler (ex.: \`onSalvar\`, \`onEnviar\`)

## Passo 5 — Chamar a ferramenta
Chame \`upsert_frontend_schema\` com:
\`\`\`json
{
  "screen_id": "<screen-id-inferido>",
  "elements": [
    { "name": "nomeCampo", "type": "string", "action": "submit" },
    ...
  ]
}
\`\`\`

## Regras importantes
- **Não inclua** classes CSS, IDs ou textos estáticos apenas para exibição.
- **Inclua** campos ocultos e condicionais (\`*ngIf\`). Marque-os com \`"action": "conditional"\`.
- Uma entrada por \`name\` distinto. Se o mesmo campo aparecer duas vezes, mescle em um.
- Ignore router-outlet e wrappers de componentes de UI de terceiros que sejam puramente visuais.
`;

export const DOTNET_MAPPING_GUIDE = `
# mcp-OmniMatch — Guia de Extração .NET Controller

Você está prestes a ler um arquivo de controller C# Web API.
Siga estes passos **exatamente** e chame \`upsert_backend_schema\` com o resultado.

## Passo 1 — Identificar o controller
Use o nome da classe como \`controller_id\` (ex.: \`ClienteController\`).
Observe o atributo \`[Route("api/[controller]")]\` para determinar o caminho base.

## Passo 2 — Localizar todos os métodos de ação HTTP
Procure pelos seguintes atributos:

| Atributo          | Método HTTP |
|-------------------|-------------|
| \`[HttpGet]\`     | GET         |
| \`[HttpPost]\`    | POST        |
| \`[HttpPut]\`     | PUT         |
| \`[HttpPatch]\`   | PATCH       |
| \`[HttpDelete]\`  | DELETE      |

Ignore métodos sem atributo \`[Http*]\` (middlewares, métodos privados, construtores).

## Passo 3 — Montar o caminho da rota
Combine a rota base do controller com o template de rota do método.
Exemplo: base = \`api/clientes\`, método = \`[HttpGet("{id}")]\` → caminho = \`/api/clientes/{id}\`.

## Passo 4 — Extrair o DTO de requisição
Verifique o(s) parâmetro(s) do método decorados com \`[FromBody]\`, \`[FromQuery]\` ou \`[FromRoute]\`.
Se o parâmetro for uma classe DTO, localize as declarações de propriedade e registre:
\`{ "nomeProp": "TipoCSharp" }\`

Mapeamento de tipos primitivos:
- \`string\` → \`string\`
- \`int\` / \`long\` → \`number\`
- \`bool\` → \`boolean\`
- \`DateTime\` / \`DateTimeOffset\` → \`Date\`
- \`Guid\` → \`string\`
- \`decimal\` / \`double\` / \`float\` → \`number\`
- Tipos anuláveis (\`T?\`) → mesmo tipo base, anote a nulabilidade

## Passo 5 — Extrair o tipo de resposta
Inspecione o tipo de retorno do método:
- \`ActionResult<T>\` ou \`Task<ActionResult<T>>\` → extraia as propriedades de \`T\`
- \`IActionResult\` → use \`return Ok(obj)\` para inferir o formato
- Registre \`{ "nomeProp": "TipoCSharp" }\`

## Passo 6 — Coletar os status codes
Procure por \`return Ok()\`, \`return Created()\`, \`return BadRequest()\`, \`return NotFound()\`, etc.
Mapeie para os números HTTP correspondentes (200, 201, 400, 404, …).

## Passo 7 — Chamar a ferramenta
Chame \`upsert_backend_schema\` com:
\`\`\`json
{
  "controller_id": "ClienteController",
  "routes": [
    {
      "path": "/api/clientes",
      "method": "POST",
      "request": { "nome": "string", "email": "string", "dataNascimento": "Date" },
      "response": { "id": "number", "nome": "string" },
      "statusCodes": [201, 400, 409]
    }
  ]
}
\`\`\`

## Regras importantes
- **Ignore** construtores, métodos privados, atributos de filtro e instruções de log.
- **Inclua** rotas sobrecarregadas como entradas separadas.
- Se a classe DTO estiver em arquivo separado e não for fornecida, registre como \`"<DtoExterno>"\`.
- Liste todos os status codes distintos que os \`return\` do método podem produzir.
`;

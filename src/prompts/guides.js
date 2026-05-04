/**
 * Prompt-steering guides for mcp-OmniMatch.
 *
 * These are returned verbatim by the generate_mapping_prompt tool so the LLM
 * receives precise extraction instructions before the user pastes source code.
 */

export const ANGULAR_MAPPING_GUIDE = `
# mcp-OmniMatch — Angular Extraction Guide

You are about to read an Angular component (.ts) and its template (.html).
Follow these steps **exactly** and call \`upsert_frontend_schema\` with the result.

## Step 1 — Identify the screen
Use the component class name or the route path as \`screen_id\`
(e.g. \`customer-registration\`, \`login-screen\`).

## Step 2 — Extract every bound field
Look for these patterns in the template and the component class:

| Source pattern                          | What to capture             |
|-----------------------------------------|-----------------------------|
| \`[(ngModel)]="fieldName"\`             | Two-way binding → field     |
| \`formControlName="fieldName"\`         | Reactive form control       |
| \`[value]="expr"\` / \`(change)="fn()"\`| One-way binding + event     |
| \`*ngFor="let item of list"\`           | Collection field            |
| \`<button (click)="fn()">\`             | Action element              |

## Step 3 — Infer the TypeScript type
Check the component class for the property declaration or FormBuilder definition.
If not found, infer from context:
- \`email\`, \`password\`, \`name\` → \`string\`
- \`age\`, \`quantity\`, \`price\` → \`number\`
- \`isActive\`, \`checked\` → \`boolean\`
- date pickers → \`Date\`
- unknown → \`any\`

## Step 4 — Identify actions
For each \`(click)\`, \`(submit)\`, \`(change)\` binding, record:
- the event name (e.g. \`submit\`, \`click\`)
- the handler method name (e.g. \`onSubmit\`)

## Step 5 — Call the tool
Call \`upsert_frontend_schema\` with:
\`\`\`json
{
  "screen_id": "<inferred-screen-id>",
  "elements": [
    { "name": "fieldName", "type": "string", "action": "submit" },
    ...
  ]
}
\`\`\`

## Important rules
- **Do not** include CSS classes, IDs, or static display-only text.
- **Do** include hidden fields and conditional fields (\`*ngIf\`). Mark them with \`"action": "conditional"\`.
- One entry per distinct \`name\`. If the same field appears twice, merge into one.
- Ignore router-outlet, third-party UI component wrappers that are purely visual.
`;

export const DOTNET_MAPPING_GUIDE = `
# mcp-OmniMatch — .NET Controller Extraction Guide

You are about to read a C# Web API controller file.
Follow these steps **exactly** and call \`upsert_backend_schema\` with the result.

## Step 1 — Identify the controller
Use the class name as \`controller_id\` (e.g. \`CustomerController\`).
Note the \`[Route("api/[controller]")]\` attribute to determine the base path.

## Step 2 — Find every HTTP action method
Look for these attributes:

| Attribute         | HTTP method |
|-------------------|-------------|
| \`[HttpGet]\`     | GET         |
| \`[HttpPost]\`    | POST        |
| \`[HttpPut]\`     | PUT         |
| \`[HttpPatch]\`   | PATCH       |
| \`[HttpDelete]\`  | DELETE      |

Ignore methods without an \`[Http*]\` attribute (middleware, private helpers, constructors).

## Step 3 — Build the route path
Combine the controller base route with the method-level route template.
Example: base = \`api/customers\`, method = \`[HttpGet("{id}")]\` → path = \`/api/customers/{id}\`.

## Step 4 — Extract the request DTO
Look at the method parameter(s) decorated with \`[FromBody]\`, \`[FromQuery]\`, or \`[FromRoute]\`.
If the parameter is a DTO class, find its property declarations and record:
\`{ "propertyName": "CSharpType" }\`

Primitive type mappings:
- \`string\` → \`string\`
- \`int\` / \`long\` → \`number\`
- \`bool\` → \`boolean\`
- \`DateTime\` / \`DateTimeOffset\` → \`Date\`
- \`Guid\` → \`string\`
- \`decimal\` / \`double\` / \`float\` → \`number\`
- Nullable types (\`T?\`) → same base type, note nullability

## Step 5 — Extract the response type
Inspect the method return type:
- \`ActionResult<T>\` or \`Task<ActionResult<T>>\` → extract properties of \`T\`
- \`IActionResult\` → use \`return Ok(obj)\` to infer the shape
- Record \`{ "propertyName": "CSharpType" }\`

## Step 6 — Collect status codes
Look for \`return Ok()\`, \`return Created()\`, \`return BadRequest()\`, \`return NotFound()\`, etc.
Map them to their HTTP numbers (200, 201, 400, 404, …).

## Step 7 — Call the tool
Call \`upsert_backend_schema\` with:
\`\`\`json
{
  "controller_id": "CustomerController",
  "routes": [
    {
      "path": "/api/customers",
      "method": "POST",
      "request": { "name": "string", "email": "string", "birthDate": "Date" },
      "response": { "id": "number", "name": "string" },
      "statusCodes": [201, 400, 409]
    }
  ]
}
\`\`\`

## Important rules
- **Ignore** constructors, private methods, filter attributes, logging statements.
- **Do** include overloaded routes as separate entries.
- If a DTO class is in a separate file and not provided, note it as \`"<ExternalDto>"\`.
- List every distinct status code that \`return\` statements can produce.
`;

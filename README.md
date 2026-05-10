# cqrs-gen

A CLI scaffolder for NestJS CQRS boilerplate. One command generates all the files for a command or query — handler, contract, request/response DTOs — and wires them into your feature module automatically.

## Installation

From the project directory, install globally so you can call it from any NestJS project:

```bash
npm install -g .
```

To uninstall:

```bash
npm uninstall -g cqrs-gen
```

## Usage

```bash
cqrs-gen --name <Name> --out <path> --type <query|command> [--dry]
```

### Options

| Flag | Required | Description |
|------|----------|-------------|
| `--name` | Yes | Feature name in PascalCase (e.g. `CreateTodo`, `GetTodos`) |
| `--out` | Yes | Output directory for the feature (e.g. `./src/features/Todos`) |
| `--type` | Yes | `command` or `query` |
| `--dry` | No | Preview what would be generated without writing any files |
| `--help` | No | Show usage information |

## Examples

```bash
# Scaffold a command
cqrs-gen --name CreateTodo --out src/features/Todos --type command

# Scaffold a query
cqrs-gen --name GetTodos --out src/features/Todos --type query

# Preview without writing
cqrs-gen --name DeleteTodo --out src/features/Todos --type command --dry
```

## What gets generated

Given `--name CreateTodo --out src/features/Todos --type command`, the tool produces:

```
src/features/Todos/
├── Todos.module.ts          ← created (or updated) automatically
├── Todos.controller.ts      ← created automatically (first run only)
└── CreateTodo/
    ├── CreateTodo.command.ts
    ├── CreateTodo.handler.ts
    ├── CreateTodo.request.ts
    └── CreateTodo.response.ts
```

### Generated files

**`CreateTodo.command.ts`** — The CQRS contract. Extend `Command<Response>` and define the constructor args your handler needs.

**`CreateTodo.handler.ts`** — The `@CommandHandler` class. Implement `execute()` with your business logic.

**`CreateTodo.request.ts`** — The inbound DTO shape sent from the client (e.g. the request body).

**`CreateTodo.response.ts`** — The outbound shape returned to the client.

### Automatic wiring

On top of generating the CQRS files, the tool handles module registration so you don't have to:

- **Feature module** (`Todos.module.ts`) — created on first run; the new handler is injected into `providers` on every subsequent run.
- **Controller** (`Todos.controller.ts`) — created on first run only, with `CommandBus` and `QueryBus` in the constructor, `@ApiTags` and `@Controller` decorators, and commented example routes. Never overwritten.
- **`app.module.ts`** — when the feature module is first created, `TodosModule` is automatically added to its `imports` array.

## Project structure convention

The tool assumes a feature-folder layout where each feature lives under a shared directory:

```
src/
└── features/
    └── Todos/               ← --out points here
        ├── Todos.module.ts
        ├── Todos.controller.ts
        ├── CreateTodo/
        │   └── ...
        └── GetTodos/
            └── ...
```

## After scaffolding

1. Fill in `CreateTodoRequest` with the properties sent from the client
2. Fill in `CreateTodoResponse` with the shape returned to the client
3. Update `CreateTodo.command.ts` with constructor args sourced from the request
4. Implement `CreateTodoHandler.execute()` with your business logic
5. Add real routes to `Todos.controller.ts`

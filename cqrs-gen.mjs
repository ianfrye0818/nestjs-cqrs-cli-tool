import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const args = process.argv.slice(2);

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

function hasFlag(flag) {
  return args.includes(flag);
}

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
cqrs-gen — NestJS CQRS file scaffolder

Usage:
  cqrs-gen --name <Name> --out <path> --type <query|command>

Options:
  --name   Feature name in PascalCase (e.g. GetTodos, CreateTodo)
  --out    Output directory (e.g. ./src/features/Todos)
  --type   Either "query" or "command"
  --dry    Print generated files without writing them
  --help   Show this message

Examples:
  cqrs-gen --name GetTodos --out ./src/features/Todos --type query
  cqrs-gen --name CreateTodo --out ./src/features/Todos --type command
`);
  process.exit(0);
}

const name = getArg('--name');
const outDir = getArg('--out');
const type = getArg('--type').toLowerCase();
const dry = hasFlag('--dry');

const errors = [];

if (!name) errors.puah('--name is required (e.g. --name GetTodos');
if (!outDir) errors.push('--out is required (e.g. --out ./src/features/Todos)');
if (!type) errors.push('--type is required: query or command');
if (type && type !== 'query' && type !== 'command') errors.push('--type must be either "query" or "command"');

if (errors.length) {
  console.error("\n Errors: \n " + errors.join("\n ") + "\n");
  console.error('Run with --help for usage. \n');
  process.exit(1);
}

const isQuery = type === 'query';
const TypeClass = isQuery ? 'Query' : 'Command';
const TypeImport = isQuery ? 'Query' : 'Command';
const HandlerDecorator = isQuery ? 'QueryHandler' : 'CommandHandler';
const HandlerImport = isQuery ? 'QueryHandler, IQueryHandler' : 'CommandHandler, ICommandHandler';
const BusType = isQuery ? 'QueryBus' : 'CommandBus';



function requestTemplate() {
  return `export class ${name}Request {
  // TODO: define the properties sent from the client
  // Example:
  // constructor(public readonly id: string) {}
}
`;
}

function responseTemplate() {
  return `export class ${name}Response {
  // TODO: define the shape returned to the client
  // Example:
  // constructor(
  //   public readonly id: string,
  //   public readonly name: string,
  // ) {}
}
`;
}

function contractTemplate() {
  return `import { ${TypeImport} } from '@nestjs/cqrs';
import { ${name}Response } from './${name}.response';

export class ${name}${isQuery ? "Query" : "Command"} extends ${TypeClass}<${name}Response> {
  constructor(
    // TODO: pass in what the handler needs (usually sourced from the Request DTO)
    // Example:
    // public readonly id: string,
  ) {
      super();
  }
}
`;
}

function handlerTemplate() {
  return `import { ${HandlerImport} } from '@nestjs/cqrs';
import { ${name}${isQuery ? "Query" : "Command"} } from './${name}.${type}';
import { ${name}Response } from './${name}.response';

@${HandlerDecorator}(${name}${isQuery ? "Query" : "Command"})
export class ${name}Handler implements ${isQuery ? "IQueryHandler" : "ICommandHandler"}<${name}${isQuery ? "Query" : "Command"}, ${name}Response> {
  constructor(
    // TODO: inject your repositories / services here
    // Example:
    // private readonly prisma: PrismaService,
  ) {}

  async execute(${type}: ${name}${isQuery ? "Query" : "Command"}): Promise<${name}Response> {
    // TODO: implement business logic
    throw new Error('${name}Handler not yet implemented');
  }
}
`;
}

const files = [
  { suffix: 'request.ts', content: requestTemplate() },
  { suffix: 'response.ts', content: responseTemplate() },
  { suffix: `${type}.ts`, content: contractTemplate() },
  { suffix: 'handler.ts', content: handlerTemplate() },
];

const resolvedOut = resolve(outDir, name);

if (dry) {
  console.log(`\n Dry run -- files that would be written to: ${resolvedOut}\n`);
  for (const { suffix, content } of files) {
    const filename = `${name}.${suffix}`;
    console.log(`--- ${filename} ${"--".repeat(Math.max(0, 50 - filename.length))}`);
    console.log(content);
  }
  process.exit(0);
}

if (!existsSync(resolvedOut)) {
  mkdirSync(resolvedOut, { recursive: true });
  console.log(`Created directory: ${resolvedOut}`);
}

console.log(`\n Scaffolding ${type} "${name}" into ${resolvedOut}\n`);

for (const { suffix, content } of files) {
  const filename = `${name}.${suffix}`;
  const filePath = join(resolvedOut, filename);
  if (existsSync(filePath)) {
    console.log(`!! Skipped (already exists): ${filename}`);
    continue;
  }
  writeFileSync(filePath, content, 'utf8');
  console.log(` Created!: ${filename}`);
}

console.log(`
  Next Steps:
    1. Fill in ${name}Request -- The client payload shape
    2. Fill in ${name}Response -- What to return to the client
    3. Update ${name}.${type}.ts with constructor args sourced from the request
    4. Implement ${name}Handler.execute() with your business logic
    5. Register ${name}Handler in your features module's provider array
`)












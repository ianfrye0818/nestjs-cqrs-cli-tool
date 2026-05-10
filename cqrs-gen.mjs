#!/usr/bin/env node
/**
 * Cqrs-gen — NestJS CQRS file scaffolder
 *
 * Usage:
 *   node cqrs-gen.mjs --name GetTodos --out ./src/features/Todos --type query
 *   node cqrs-gen.mjs --name CreateTodo --out ./src/features/Todos --type command
 *
 * Or install globally:
 *   npm install -g .   (from the directory containing this file + package.json)
 *   cqrs-gen --name GetTodos --out ./src/features/Todos --type query
 */
import { join, resolve, basename, dirname, relative } from 'path';
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';

// ─── Arg parsing ─────────────────────────────────────────────────────────────

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


// ─── Validation ───────────────────────────────────────────────────────────────

const errors = [];

if (!name) errors.push('--name is required (e.g. --name GetTodos');
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


// ─── Template generators ──────────────────────────────────────────────────────

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

// ─── Module helpers ───────────────────────────────────────────────────────────

function entityNameFromDir(dir) {
  const base = basename(dir);
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function moduleTemplate(entityName, handlerName, handlerFile) {
  return `import { Module } from '@nestjs/common';
import { ${handlerName} } from './${name}/${handlerFile}';

@Module({
  imports: [],
  controllers: [],
  providers: [
    ${handlerName},
  ],
  exports: [],
})
export class ${entityName}Module {}
`;
}

function findExistingModule(dir) {
  if (!existsSync(dir)) return null;
  const match = readdirSync(dir).find((f) => f.endsWith(".module.ts"));
  return match ? join(dir, match) : null;
}

function findAppModule(startDir) {
  let dir = resolve(startDir);
  while (true) {
    const candidate = join(dir, 'app.module.ts');
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) return null;
    dir = parent;
  }
}

function injectModuleIntoAppModule(source, entityModuleName, entityModulePath, appModulePath) {
  let result = source;
  let changed = false;

  const relPath = './' + relative(dirname(appModulePath), entityModulePath).replace(/\\/g, '/').replace(/\.ts$/, '');

  const alreadyImported = result.includes(`'${relPath}'`) || result.includes(`"${relPath}"`);

  if (!alreadyImported) {
    const importLine = `import { ${entityModuleName} } from '${relPath}';`;
    const importRegex = /^import .+from .+;$/gm;
    let lastImportEnd = -1;
    let match;
    while ((match = importRegex.exec(result)) !== null) {
      lastImportEnd = match.index + match[0].length;
    }
    if (lastImportEnd === -1) {
      result = importLine + '\n' + result;
    } else {
      result = result.slice(0, lastImportEnd) + '\n' + importLine + result.slice(lastImportEnd);
    }
    changed = true;
  }

  const importsRegex = /(imports\s*:\s*\[)([\s\S]*?)(\])/;
  const importsMatch = importsRegex.exec(result);
  if (!importsMatch) {
    return { source: result, changed, error: 'Could not locate imports array in app.module.ts' };
  }

  const [, open, inner, close] = importsMatch;
  if (inner.includes(entityModuleName)) {
    return { source: result, changed, error: null };
  }

  const trimmed = inner.trim();
  let newInner;
  if (trimmed === '') {
    newInner = `\n    ${entityModuleName},\n  `;
  } else {
    const normalized = trimmed.replace(/,?\s*$/, ',');
    newInner = `\n    ${normalized}\n    ${entityModuleName},\n  `;
  }

  result = result.replace(importsRegex, `${open}${newInner}${close}`);
  return { source: result, changed: true, error: null };
}

/**
 * Inject a handler into an existing module file.
 * Independently handles the import line and the providers array.
 * Returns { source, changed, error }.
 */
function injectHandlerIntoModule(source, handlerName, handlerFile) {
  let result = source;
  let changed = false;


  // Import Statement
  const importPath = `./${name}/${handlerFile}`
  const alreadyImported =
    result.includes(`'${importPath}'`) || result.includes(`"${importPath}"`);


  if (!alreadyImported) {
    const importLine = `import { ${handlerName} } from '${importPath}';`;
    const importRegex = /^import .+from .+;$/gm;
    let lastImportEnd = -1;
    let match;
    while ((match = importRegex.exec(result)) !== null) {
      lastImportEnd = match.index + match[0].length;
    }

    if (lastImportEnd === -1) {
      result = importLine + "\n" + result;
    } else {
      result =
        result.slice(0, lastImportEnd) +
        "\n" +
        importLine +
        result.slice(lastImportEnd);
    }
    changed = true;
  }

  // Providers array
  // Check if handlerName already appears inside the providers block specifically
  const providerRegex = /(providers\s*:\s*\[)([\s\S]*?)(\])/;
  const providersMatch = providerRegex.exec(result);

  if (!providersMatch) {
    return { source: result, changed, error: 'Could not locate providers array' };
  }

  const [, open, inner, close] = providersMatch;

  // Check if this specific handler is already in the providers array
  if (inner.includes(handlerName)) {
    // Already registered - nothing more to do
    return { source: result, changed, error: null };
  }

  const trimmed = inner.trim();
  let newInner;
  if (trimmed === "") {
    newInner = `\n   ${handlerName},\n   `;
  } else {
    const normalized = trimmed.replace(/,?\s*$/, ",");
    newInner = `\n    ${normalized}\n    ${handlerName},\n  `;
  }

  result = result.replace(providerRegex, `${open}${newInner}${close}`);
  return { source: result, changed: true, error: null };
}


// ─── File definitions ─────────────────────────────────────────────────────────


const files = [
  { suffix: 'request.ts', content: requestTemplate() },
  { suffix: 'response.ts', content: responseTemplate() },
  { suffix: `${type}.ts`, content: contractTemplate() },
  { suffix: 'handler.ts', content: handlerTemplate() },
];

const handlerClassName = `${name}Handler`;
const handlerFileName = `${name}.handler`;


// ─── Dry run ──────────────────────────────────────────────────────────────────


const resolvedOut = resolve(outDir, name);

if (dry) {
  console.log(`\n🔍 Dry run -- files that would be written to: ${resolvedOut}\n`);
  for (const { suffix, content } of files) {
    const filename = `${name}.${suffix}`;
    console.log(`--- ${filename} ${"--".repeat(Math.max(0, 50 - filename.length))}`);
    console.log(content);
  }

  const existingModule = findExistingModule(outDir);

  if (existingModule) {
    const src = readFileSync(existingModule, 'utf8');
    const { source: updated, error } = injectHandlerIntoModule(src, handlerClassName, handlerFileName);
    console.log(`--- ${basename(existingModule)} (would be updated) ${"-".repeat(10)}`);
    console.log(error ? `!! ${error} - manual update needed.` : updated);
  } else {
    const entityName = entityNameFromDir(outDir);
    const moduleFileName = `${entityName}.module.ts`;
    const modulePath = join(outDir, moduleFileName);
    console.log(`--- ${moduleFileName} (would be created) ${"-".repeat(10)}`);
    console.log(moduleTemplate(entityName, handlerClassName, handlerFileName));

    const appModulePath = findAppModule(outDir);
    if (appModulePath) {
      const appSrc = readFileSync(appModulePath, 'utf8');
      const { source: updatedApp, error: appError } = injectModuleIntoAppModule(appSrc, `${entityName}Module`, modulePath, appModulePath);
      console.log(`--- app.module.ts (would be updated) ${"-".repeat(10)}`);
      console.log(appError ? `!! ${appError} - manual update needed.` : updatedApp);
    }
  }

  process.exit(0);
}


// ─── Write CQRS files ─────────────────────────────────────────────────────────


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

// ─── Module: update or create ─────────────────────────────────────────────────

console.log();

const existingModulePath = findExistingModule(outDir);
if (existingModulePath) {
  const moduleFileName = basename(existingModulePath);
  const src = readFileSync(existingModulePath, 'utf8');
  const { source: updated, error, changed } = injectHandlerIntoModule(src, handlerClassName, handlerFileName);


  if (error) {
    console.log(`!! Found ${moduleFileName} but ${error}.`);
    console.log(`   Add ${handlerClassName} to providers manually.\n`);
  } else if (!changed) {
    console.log(` !! ${moduleFileName} already contains ${handlerClassName} -- skipped.\n`);
  } else {
    writeFileSync(existingModulePath, updated, 'utf8');
    console.log(` ${moduleFileName} - injected ${handlerClassName} into providers\n`);
  }
} else {
  const entityName = entityNameFromDir(outDir);
  const moduleFileName = `${entityName}.module.ts`;
  const modulePath = join(outDir, moduleFileName);
  const content = moduleTemplate(entityName, handlerClassName, handlerFileName);

  writeFileSync(modulePath, content, 'utf8');
  console.log(` ${moduleFileName} - created for ${handlerClassName} in providers\n`);

  const appModulePath = findAppModule(outDir);
  if (appModulePath) {
    const appSrc = readFileSync(appModulePath, 'utf8');
    const { source: updatedApp, changed: appChanged, error: appError } = injectModuleIntoAppModule(
      appSrc, `${entityName}Module`, modulePath, appModulePath
    );
    if (appError) {
      console.log(`!! Found app.module.ts but ${appError}.\n   Add ${entityName}Module to imports manually.\n`);
    } else if (!appChanged) {
      console.log(` !! app.module.ts already contains ${entityName}Module -- skipped.\n`);
    } else {
      writeFileSync(appModulePath, updatedApp, 'utf8');
      console.log(` app.module.ts - injected ${entityName}Module into imports\n`);
    }
  }
}

// ─── Next steps ───────────────────────────────────────────────────────────────

console.log(`
  Next Steps:
    1. Fill in ${name}Request -- The client payload shape
    2. Fill in ${name}Response -- What to return to the client
    3. Update ${name}.${type}.ts with constructor args sourced from the request
    4. Implement ${name}Handler.execute() with your business logic
    5. Register ${name}Handler in your features module's provider array
`)












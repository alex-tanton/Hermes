# Coding Standards & Conventions

## Overview
This document outlines the coding patterns, linting policies, formatting requirements, and architectural conventions enforced across the Referral-Repeater codebase.

---

## Language & Module Standards

1. **TypeScript Strictness**:
   - `strict: true` in `tsconfig.json`.
   - `noImplicitAny`, `strictNullChecks`, and `strictBindCallApply` are enabled.
   - Any usage of `any` triggers an ESLint warning (`@typescript-eslint/no-explicit-any: "warn"`).

2. **ECMAScript Modules (ESM)**:
   - Module resolution uses `NodeNext`.
   - All relative TypeScript imports **MUST** include explicit `.js` extensions:
     ```typescript
     // Correct
     import { AppConfig } from '../types/index.js';
     import { loadConfig } from './loader.js';

     // Incorrect (will fail under NodeNext)
     import { AppConfig } from '../types';
     import { loadConfig } from './loader';
     ```

---

## Code Formatting (Prettier)

Defined in `.prettierrc`:
```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```
- Commands:
  - Check formatting: `npm run format:check`
  - Apply formatting: `npm run format`

---

## Linting (ESLint)

Defined in `.eslintrc.json`:
- Parser: `@typescript-eslint/parser`
- Extended Configs: `eslint:recommended`, `plugin:@typescript-eslint/recommended`
- Custom Rules:
  - `no-console: "off"`: Allowed because the application is a CLI utility.
  - `@typescript-eslint/no-unused-vars`: Enforces errors while permitting arguments and variables prefixed with an underscore (`^_`).
  - `dist/`, `node_modules/`, `coverage/` are explicitly ignored.
- Commands:
  - Run linter: `npm run lint`
  - Auto-fix issues: `npm run lint:fix`

---

## Commit Guidelines (Conventional Commits)

Managed by Husky (`.husky/commit-msg`) and Commitlint (`commitlint.config.js`).

### Format
```
<type>(<scope>): <subject>
```

### Allowed Types
- `feat`: New feature or capability
- `fix`: Bug fix
- `docs`: Documentation updates
- `style`: Formatting or whitespace changes
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or correcting tests
- `build`: Build system or dependency updates
- `ci`: Continuous integration changes
- `chore`: Routine maintenance or configuration tasks

---

## Naming Conventions

| Category | Convention | Examples |
| :--- | :--- | :--- |
| Classes | PascalCase | `ReferralRepeaterEngine`, `AutonomousScheduler` |
| Exported Singletons | camelCase | `platformRegistry`, `templateEngine`, `logger` |
| Interfaces & Types | PascalCase | `ReferralLink`, `PlatformType`, `AppConfig` |
| Functions & Methods | camelCase | `executeCycle()`, `substituteEnvVars()`, `runInitWizard()` |
| Source Files | kebab-case / lowercase | `schema.ts`, `loader.ts`, `defaults.ts`, `engine.ts` |
| Test Files | `*.test.ts` mirroring subject | `engine.test.ts`, `platforms.test.ts` |

---

## Error Handling & Reliability Patterns

1. **Schema Validation First**:
   - Never trust raw user inputs or YAML configurations directly.
   - Parse through Zod schemas using `safeParse`. Format nested issue paths cleanly:
     ```typescript
     const result = AppConfigSchema.safeParse(data);
     if (!result.success) {
       const details = result.error.errors.map(err => `  - [${err.path.join('.')}]: ${err.message}`).join('\n');
       throw new Error(`Configuration error:\n${details}`);
     }
     ```

2. **Result Objects over Thrown Errors**:
   - Platform dispatches return a structured `PostResult` instead of throwing unhandled exceptions:
     ```typescript
     return {
       success: false,
       platform: this.name,
       linkId: payload.referralLink.id,
       simulated: false,
       timestamp: new Date().toISOString(),
       messagePreview: payload.formattedContent,
       error: 'Detailed message',
     };
     ```

3. **Graceful Storage Degradation**:
   - `HistoryTracker` and `Logger` wrap disk writes in `try/catch` blocks so that failures in read-only environments do not crash the distribution loop.

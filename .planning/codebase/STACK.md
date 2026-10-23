# Technology Stack

## Overview
**Referral-Repeater** is a modern, standalone TypeScript/Node.js application engineered for autonomous referral link scheduling and distribution. It uses zero external database dependencies, relying on JSON file-backed state persistence and environment variable substitution.

---

## Core Runtime & Language
- **Language**: TypeScript 5.7.3
- **Runtime**: Node.js `>= 18.0.0` (ES2022 target, `NodeNext` module resolution)
- **Module System**: ECMAScript Modules (`type: "module"` in `package.json`, `.js` extension imports in TypeScript source)
- **Compiler Options** (`tsconfig.json`):
  - `target`: `ES2022`
  - `module`: `NodeNext`
  - `moduleResolution`: `NodeNext`
  - `strict`: `true`
  - `declaration`: `true`, `declarationMap`: `true`, `sourceMap`: `true`
  - `outDir`: `./dist`

---

## Production Dependencies

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `commander` | `^13.1.0` | CLI argument parsing, subcommands (`init`, `post`, `daemon`, `validate`, `history`), flags, help |
| `@inquirer/prompts` | `^7.3.2` | Interactive terminal UI wizard for friends/family setup (`input`, `confirm`, `checkbox`, `select`) |
| `zod` | `^3.24.2` | Schema validation with strict types and runtime error formatting for `config.yaml` |
| `yaml` | `^2.7.0` | Parsing and serializing human-readable YAML configurations |
| `node-cron` | `^3.0.3` | Background recurring job scheduler using standard 5-field cron syntax |
| `chalk` | `^4.1.2` | Terminal output styling, colored log levels, preview box rendering |
| `dotenv` | `^16.4.7` | Loading `.env` file into process environment |
| `ora` | `^5.4.1` | Terminal spinners for interactive CLI operations |

---

## Development Dependencies & Quality Tooling

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `tsx` | `^4.19.3` | Zero-configuration TypeScript runtime execution for scripts (`npm run start`, `npm run post`, etc.) |
| `typescript` | `^5.7.3` | TypeScript compiler (`tsc`) for type-checking and building `./dist` |
| `vitest` | `^3.0.6` | Modern, fast unit testing framework with native ESM and TS support |
| `eslint` | `^8.57.1` | Static code analysis and linting |
| `@typescript-eslint/parser` | `^8.24.1` | AST parser for TypeScript linting |
| `@typescript-eslint/eslint-plugin` | `^8.24.1` | Recommended TypeScript lint rules |
| `prettier` | `^3.5.1` | Opinionated code formatter (single quotes, 2-space indent, 100 char width) |
| `husky` | `^9.1.7` | Git hooks manager for pre-commit linting and commit-msg enforcement |
| `@commitlint/cli` | `^19.7.1` | Conventional Commits validator |
| `@commitlint/config-conventional` | `^19.7.1` | Conventional Commits ruleset |

---

## Build & Execution Pipeline

- **Development Execution**: `npx tsx src/cli/index.ts <subcommand>` (no prior build step required)
- **Production Build**: `tsc` outputs transpiled JavaScript and `.d.ts` declaration files to `./dist/`
- **CLI Binary**: Exposed as `referral-repeater` via `./dist/cli/index.js`

---

## Data & Storage Layer

- **Database**: None. The engine is deliberately zero-dependency and serverless-friendly.
- **Audit & Cooldown State**: Local JSON file at `.data/history.json` managed by `HistoryTracker`.
  - Automatically created on startup if missing.
  - Safely handles transient environments.
- **Log Files**: Rotating plain text log written to `logs/referral-repeater.log` with ANSI escape code stripping.

---

## Configuration & Environment Loading

- **Format**: YAML (`config.yaml`), with fallbacks to `config.yml`, `config.json`, `config.local.yaml`, and `config.example.yaml`.
- **Interpolation**: Custom regex-based `${VAR_NAME}` and `${VAR_NAME:-default}` resolver recursively applied before Zod parsing.

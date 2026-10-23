# Codebase Structure & Directory Layout

## Directory Map

```
Referral-Repeater/
├── .data/                                # Persistent local state
│   └── history.json                      # Deduplication and cooldown audit trail
├── logs/                                 # Log output
│   └── referral-repeater.log             # Rotating application logs
├── src/                                  # Application source code
│   ├── cli/                              # CLI commands & interactive setup
│   │   ├── commands/
│   │   │   ├── daemon.ts                 # Background scheduler daemon runner
│   │   │   ├── history.ts                # Audit trail & stats viewer
│   │   │   ├── init.ts                   # Interactive onboarding wizard (@inquirer)
│   │   │   ├── post.ts                   # Immediate distribution cycle command
│   │   │   └── validate.ts               # Config and credential health validator
│   │   └── index.ts                      # Commander CLI entry point
│   ├── config/                           # Configuration management
│   │   ├── defaults.ts                   # Default cards, programs, and settings
│   │   ├── loader.ts                     # File loader with env var substitution
│   │   └── schema.ts                     # Zod validation schemas
│   ├── core/                             # Core orchestration & scheduling
│   │   ├── engine.ts                     # ReferralRepeaterEngine orchestrator
│   │   ├── history.ts                    # HistoryTracker JSON storage
│   │   ├── logger.ts                     # Colored preview boxes & file logging
│   │   └── scheduler.ts                  # AutonomousScheduler (cron + jitter)
│   ├── platforms/                        # Social & community platform adapters
│   │   ├── base.ts                       # BasePlatformAdapter abstract class
│   │   ├── bluesky.ts                    # Bluesky / AT Protocol adapter
│   │   ├── discord.ts                    # Discord Webhook & channel adapter
│   │   ├── facebook.ts                   # Facebook Graph API / group adapter
│   │   ├── reddit.ts                     # Reddit API / megathread adapter
│   │   ├── registry.ts                   # PlatformRegistry lifecycle manager
│   │   └── twitter.ts                    # Twitter / X API v2 adapter
│   ├── programs/                         # Referral program category definitions
│   │   ├── registry.ts                   # Pre-configured programs (Cards, Shopping, etc.)
│   │   └── types.ts                      # Program metadata interfaces
│   ├── templates/                        # Content generation & personalization
│   │   └── engine.ts                     # TemplateEngine (anecdotes, FTC, tone, syntax)
│   ├── types/                            # Domain models & TypeScript interfaces
│   │   └── index.ts                      # Shared types across all modules
│   └── index.ts                          # Public programmatic library exports
├── tests/                                # Vitest test suite
│   ├── config.test.ts                    # Schema & loader tests
│   ├── engine.test.ts                    # ReferralRepeaterEngine workflow tests
│   ├── history.test.ts                   # HistoryTracker & cooldown tests
│   ├── platforms.test.ts                 # Platform adapter credential & simulation tests
│   ├── programs.test.ts                  # ProgramRegistry extension tests
│   ├── scheduler.test.ts                 # AutonomousScheduler cron & jitter tests
│   └── template.test.ts                  # TemplateEngine formatting & clipping tests
├── .eslintrc.json                        # ESLint configuration
├── .gitignore                            # Git exclusion rules
├── .prettierrc                           # Prettier formatting rules
├── .prettierignore                       # Prettier exclusions
├── commitlint.config.js                  # Conventional Commits rules
├── config.example.yaml                   # Comprehensive reference configuration
├── INSTALL.md                            # Step-by-step setup guide
├── package.json                          # Package scripts and dependencies
├── README.md                             # Comprehensive project documentation
├── REFERRAL_LINKS.md                     # Raw referral links reference
├── tsconfig.json                         # TypeScript compiler configuration
└── vitest.config.ts                      # Vitest test runner configuration
```

---

## File Responsibilities

| Path | Primary Responsibility | Key Exports |
| :--- | :--- | :--- |
| `src/index.ts` | Programmatic library root export | All types, schemas, engines, and registries |
| `src/cli/index.ts` | CLI executable entry point (`referral-repeater`) | Commander program setup |
| `src/cli/commands/init.ts` | Interactive setup wizard for friends/family | `runInitWizard()` |
| `src/cli/commands/post.ts` | Manual / immediate cycle execution | `runPostCommand()` |
| `src/cli/commands/daemon.ts` | Continuous background runner | `runDaemonCommand()` |
| `src/cli/commands/validate.ts` | Config syntax and credentials validator | `runValidateCommand()` |
| `src/cli/commands/history.ts` | Posting history and stats viewer | `runHistoryCommand()` |
| `src/config/schema.ts` | Zod schema validation rules | `AppConfigSchema`, `ReferralLinkSchema`, etc. |
| `src/config/loader.ts` | File discovery, env interpolation, loading | `loadConfig()`, `saveConfig()`, `substituteEnvVars()` |
| `src/config/defaults.ts` | Fallback configuration and card links | `DEFAULT_CONFIG` |
| `src/core/engine.ts` | Distribution cycle orchestration & filtering | `ReferralRepeaterEngine` |
| `src/core/scheduler.ts` | Autonomous cron scheduling with jitter | `AutonomousScheduler` |
| `src/core/history.ts` | Post history storage and cooldown tracking | `HistoryTracker`, `historyTracker` |
| `src/core/logger.ts` | Colored preview boxes & file logging | `Logger`, `logger` |
| `src/platforms/base.ts` | Abstract adapter base class | `BasePlatformAdapter` |
| `src/platforms/registry.ts` | Dynamic adapter lifecycle manager | `PlatformRegistry`, `platformRegistry` |
| `src/platforms/reddit.ts` | Reddit post and comment adapter | `RedditAdapter` |
| `src/platforms/discord.ts` | Discord webhook and channel adapter | `DiscordAdapter` |
| `src/platforms/bluesky.ts` | Bluesky microblog adapter | `BlueskyAdapter` |
| `src/platforms/facebook.ts` | Facebook group and feed adapter | `FacebookAdapter` |
| `src/platforms/twitter.ts` | Twitter / X tweet adapter | `TwitterAdapter` |
| `src/programs/types.ts` | Program metadata interfaces | `ProgramMetadata` |
| `src/programs/registry.ts` | Pre-configured referral programs | `ProgramRegistry`, `programRegistry` |
| `src/templates/engine.ts` | Content generation, FTC, formatting | `TemplateEngine`, `templateEngine` |
| `src/types/index.ts` | Central TypeScript domain type definitions | `AppConfig`, `ReferralLink`, `PostPayload`, etc. |

---

## Import Boundaries & Module Relationships

- **Types (`src/types/`)**: Imported by virtually all modules; has zero local dependencies.
- **Config (`src/config/`)**: Imports from `types/` only. Does not depend on `core/`, `platforms/`, or `cli/`.
- **Platforms (`src/platforms/`)**: Depends on `types/` and `base.ts`. Platform adapters do not depend on `core/` or `cli/`.
- **Programs (`src/programs/`)**: Self-contained domain registry depending only on `types/`.
- **Templates (`src/templates/`)**: Depends on `types/` and `programs/registry.ts`.
- **Core (`src/core/`)**: Depends on `types/`, `config/`, `platforms/registry.ts`, `templates/engine.ts`.
- **CLI (`src/cli/`)**: The top-level orchestrator importing all underlying layers (`config/`, `core/`, `platforms/`, `types/`).

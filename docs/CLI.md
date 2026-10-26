# CLI Reference

| Command                                    | Description                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `npm run setup` / `npx hermes init`        | Interactive guided wizard to create/update `config.yaml`                    |
| `npm run post` / `npx hermes post`         | Executes a one-off distribution cycle (safe dry-run by default)             |
| `npm run post -- --platform reddit`        | Dispatches to a specific platform only                                      |
| `npm run post -- --category shopping`      | Dispatches only links in a specific category                                |
| `npm run post -- --tone deal_alert`        | Overrides message tone (`story`, `informative`, `deal_alert`, `comparison`) |
| `npm run post -- --force`                  | Bypasses cooldowns and daily post caps (useful for testing)                 |
| `npm run post -- --live`                   | Executes live network posts using configured platform credentials           |
| `npm run daemon` / `npx hermes daemon`     | Starts autonomous scheduler daemon running on configured cron               |
| `npm run validate` / `npx hermes validate` | Inspects `config.yaml`, checks platform credentials, and lists links        |
| `npm run history` / `npx hermes history`   | Displays recent post history and platform analytics                         |
| `npm run history -- --clear`               | Resets posting history and cooldown cache                                   |

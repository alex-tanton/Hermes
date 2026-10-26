# Troubleshooting & FAQ

### Q: Why are no posts showing up on forums?

- Ensure `dryRun: false` in `config.yaml` (or pass `--live` on the CLI). By default, the application runs in **Safe Dry-Run** mode to protect your accounts until you intentionally activate live mode.

### Q: Why did the engine skip posting a card?

- Check link cooldowns: Each card has a `linkCooldownHours` setting (default: 24h) to avoid posting duplicate offers repeatedly. Use `--force` to bypass cooldowns during manual testing.
- View recent history with:
  ```bash
  npm run history
  ```

### Q: How do I clear the cooldown and post history?

```bash
npm run history -- --clear
```

### Q: How do I add my own credit card or shopping link?

- Simply add a new item under `referralLinks:` in `config.yaml` or re-run `npm run setup`.

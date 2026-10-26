# Anti-Spam Cooldowns, Rotation & Compliance

1. **Dry-Run by Default**: Network calls to live social platforms are prevented unless `dryRun: false` and the CLI flag `--live` are explicitly passed.
2. **Granular Per-Platform Cooldowns**: Supports platform-specific `cooldownHours` overrides (e.g., 720h / 30-day cooldown for Reddit monthly megathreads vs. 12h for Discord deal channels), falling back to `schedule.linkCooldownHours`.
3. **Independent Per-Platform Daily Caps**: Platforms can specify `maxPostsPerDay` limits. If Reddit reaches its daily limit, other platforms continue operating seamlessly without halting the entire cycle.
4. **Fair Round-Robin & Priority Rotation**: Referral links support an optional `priority` (1-100, default 50). Links with higher priority are selected first; links with equal priority rotate in a strict least-recently-posted round-robin manner to prevent link starvation.
5. **Twitter/X `t.co` URL Budgeting**: Any URL in a tweet is budgeted at fixed 23 characters (the standard Twitter `t.co` shortener length). Long referral URLs (80-120+ characters) do not prematurely truncate the message title or description.
6. **Automatic Rate-Limit Backoff**: If any platform encounters HTTP 429 rate limits, Hermes automatically pauses posting to that platform while permitting remaining platforms to operate unimpeded.
7. **History Truncation & Mutex Locking**: Persistent records are atomically locked with `proper-lockfile` and bounded by configurable retention caps to preserve disk hygiene.
8. **FTC Referral Disclosure**: In accordance with FTC guidelines (16 CFR Part 255), all generated posts automatically append transparent referral disclosures when `includeFtcDisclosure: true`.

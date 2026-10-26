# Architecture

```
                       +----------------------------------+
                       |           config.yaml            |
                       | (YAML Schema & Env Substitution) |
                       +-----------------+----------------+
                                         |
                                         v
+-----------------------+     +-------------------+     +-------------------------+
|  User-Friendly CLI    |     |  Program Registry |     | Autonomous Scheduler    |
| (Setup Wizard/Manual) | --> | (Cards, Shopping) | --> | (Cron + Anti-Bot Jitter)|
+-----------------------+     +---------+---------+     +------------+------------+
                                        |                            |
                                        v                            v
                       +----------------------------------+
                       |          HermesEngine            |
                       |  - Link Rotation & Eligibility   |
                       |  - Cooldown & Daily Cap Checking |
                       +-----------------+----------------+
                                         |
                                         v
                       +----------------------------------+
                       |        TemplateEngine            |
                       |  - Personal Anecdote Injection   |
                       |  - FTC Referral Disclosure       |
                       |  - Platform Formatting/Clipping  |
                       +-----------------+----------------+
                                         |
        +--------------------------------+--------------------------------+
        |                |               |                |               |
        v                v               v                v               v
+---------------+ +---------------+ +----------+ +-----------------+ +----------+
| RedditAdapter | |FacebookAdapter| | Bluesky  | | Discord Webhook | | Twitter  |
| (Subreddits / | |(Groups / Feed | | (AT Proto| | (Channels /     | | (API v2  |
| Megathreads)  | |  Graph API)   | | 300 char)| | Rich Markdown)  | | 280 char)|
+-------+-------+ +-------+-------+ +----+-----+ +--------+--------+ +----+-----+
        |                 |              |                |               |
        +--------------------------------+--------------------------------+
                                         |
                                         v
                       +----------------------------------+
                       |    HistoryTracker & Audit Logger |
                       |  - .data/history.json (Audit)    |
                       |  - logs/hermes.log               |
                       +-----------------+----------------+
```

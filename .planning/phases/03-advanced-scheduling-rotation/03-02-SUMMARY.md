---
phase: 03-advanced-scheduling-rotation
plan: 02
status: complete
completed_at: "2026-10-23T17:08:00.000Z"
requirements:
  - ROT-03
  - ROT-01
  - ROT-02
files_modified:
  - src/templates/engine.ts
  - tests/template.test.ts
  - config.example.yaml
  - README.md
---

# Plan 03-02 Summary: Twitter URL Length Budgeting and Configuration Docs

## Accomplishments

1. **Twitter URL Budgeting (ROT-03)**:
   - Added `calculateTwitterLength(text: string): number` adhering to Twitter standard where URLs consume fixed 23 characters (`t.co`).
   - Updated `TemplateEngine.formatForPlatform` and `fitToLength` with `urlLengthWeight: 23` for Twitter.
   - Long referral URLs (100+ chars) no longer cause premature truncation of the message body.

2. **Configuration Examples & Documentation**:
   - Updated `config.example.yaml` with explicit examples and comments for per-platform `cooldownHours` (e.g. 720h Reddit megathread vs 12h Discord), `maxPostsPerDay`, and link `priority`.
   - Updated `README.md` anti-spam and scheduling sections documenting round-robin rotation, priority weighting, and Twitter URL budgeting.

3. **Verification**:
   - Unit tests in `tests/template.test.ts` verify Twitter budgeting and long URL resilience.
   - All tests pass cleanly.

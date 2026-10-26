# State Persistence & Backup Best Practices

Hermes follows a zero-database architecture, storing all persistent state in lightweight, auditable JSON and rotating log files:

### Data Architecture

- **`.data/history.json`**: Primary ledger containing full distribution history, last-posted timestamps, FTC disclosure records, and per-link cooldown caches.
- **Cross-Process Mutex**: Writes are protected by `proper-lockfile` and atomic temporary file renames (`.data/history.json.tmp.*`), ensuring zero data corruption during concurrent operations or process restarts.
- **`logs/hermes.log`**: Detailed runtime log recording cycle executions, link selections, network responses, and simulation results.

### Recommended Backup Strategy

To preserve your link rotation memory and avoid repeating recently shared links:

```bash
# Create an ad-hoc backup of posting history
cp .data/history.json .data/history.backup.$(date +%Y%m%d).json
```

In Docker environments, the host `./.data` directory is permanently mapped, ensuring backups can be taken directly from the host filesystem without entering the container.

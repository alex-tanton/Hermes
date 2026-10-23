# Phase 02: Live Platform Network Dispatches - Research

**Phase:** 02-live-platform-network-dispatches  
**Domain:** External HTTP API clients, OAuth 1.0a / OAuth2 authentication, AT Protocol / XRPC, webhook dispatch, resilience and non-crashing error handling  
**Confidence:** HIGH  
**Date:** 2026-10-23  

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **LIVE-01** | Implement real HTTP `fetch` dispatch for `DiscordAdapter` using incoming webhook URLs. | Native `fetch` with `POST {webhookUrl}?wait=true`, JSON payload, Discord markdown, rate limit (HTTP 429) detection, and structured message URL resolution. |
| **LIVE-02** | Implement live XRPC / AT Protocol dispatch for `BlueskyAdapter` using handle authentication and app passwords. | AT Protocol XRPC session creation via `com.atproto.server.createSession`, authenticated record creation via `com.atproto.repo.createRecord`, and AT-URI to `bsky.app` canonical URL mapping. |
| **LIVE-03** | Implement live Reddit API dispatch for `RedditAdapter` with OAuth2 authentication for posts and comments. | Standard Reddit OAuth2 password grant flow (`/api/v1/access_token`) with required custom User-Agent, followed by `/api/submit` for text/link posts and `/api/comment` for comment targets. |
| **LIVE-04** | Implement live Twitter/X API v2 dispatch for `TwitterAdapter` with OAuth signatures. | Twitter API v2 (`POST https://api.twitter.com/2/tweets`) using pure Node.js `crypto` OAuth 1.0a HMAC-SHA1 header generation (zero external dependencies) with nonce, timestamp, and signature encoding. |
| **LIVE-05** | Implement live Graph API dispatch for `FacebookAdapter`. | Meta Graph API v19.0+ (`POST https://graph.facebook.com/v19.0/{targetId}/feed`) with page/group/feed target resolution, URL attachment, and Graph API error parsing. |
| **LIVE-06** | Verify that all live network calls fail safely back to structured error results when offline or given invalid tokens, without uncaught exceptions. | Per-adapter defensive try/catch blocks, `AbortSignal.timeout(10000)` timeout caps, HTTP status checking, and standardized `createErrorResult` output guaranteeing zero uncaught exceptions in daemon or CLI cycles. |
</phase_requirements>

---

## Executive Summary

Phase 2 replaces the mock/simulated dispatch logic in the five platform adapters (`DiscordAdapter`, `BlueskyAdapter`, `RedditAdapter`, `TwitterAdapter`, and `FacebookAdapter`) with genuine HTTP API calls. In v1.0, these adapters implemented credential validation and `dryRun` simulation, returning stub IDs (e.g. `sim_reddit_...`). In live mode, they returned hardcoded stub responses without initiating network activity.

By adopting native Node.js `fetch` (standard in Node >= 18) and native `crypto` for OAuth 1.0a signatures, all five live platform dispatches can be implemented with **zero additional npm runtime dependencies**. This avoids supply-chain attack surface, bundle bloat, and SDK version incompatibility.

Crucially, requirement `LIVE-06` dictates that no network failure, DNS error, rate limit (HTTP 429), or API credential rejection may throw an unhandled exception or crash the daemon loop. Every adapter must return a strongly typed `PostResult` (`success: false`, `simulated: false`, `error: string`).

---

## Standard Stack & Tooling

### Dependencies & Environment Audit

- **Runtime:** Node.js `>= 18.0.0` (Active environment: Node `v22.13.0`).
- **HTTP Client:** Built-in global `fetch`, `Headers`, `Request`, `Response`, `AbortSignal.timeout()`.
- **Crypto Engine:** Built-in `node:crypto` (`createHmac`, `randomBytes`) for OAuth 1.0a signing.
- **Testing Framework:** Vitest `3.0.6` with `vi.spyOn(globalThis, 'fetch')` / `vi.stubGlobal('fetch', ...)` for exhaustive deterministic network mocking (offline, 401, 429, 500, network timeouts, malformed payloads).
- **External Dependencies to Add:** None (0 runtime dependencies needed).

---

## Architecture Patterns & Implementation Strategy

### 1. Unified Request Resilience Pattern

To guarantee compliance with `LIVE-06`, all network requests will adhere to a consistent resilience pattern:
1. **Explicit Timeout Cap:** Every HTTP call attaches an `AbortSignal.timeout(10000)` (10 seconds), preventing hung sockets from stalling the daemon.
2. **Credential Pre-Flight:** Call `this.validateCredentials()` prior to any network dispatch.
3. **Structured Response Inspection:** Check `response.ok` (HTTP 200–299). If not ok, parse error payload (JSON or text) and format a human-readable diagnostic error message.
4. **Structured PostResult on Failure:** Catch all exceptions (`TypeError` on network failure, `AbortError` / `TimeoutError` on timeout, API error codes) and return `this.createErrorResult(...)`.

```typescript
// Standard Adapter Post Pattern
try {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return this.createErrorResult(payload, `HTTP ${response.status}: ${errorBody}`, destination);
  }

  const data = await response.json();
  return {
    success: true,
    platform: this.name,
    linkId: payload.referralLink.id,
    postId: extractPostId(data),
    postUrl: buildCanonicalUrl(data),
    simulated: false,
    timestamp: new Date().toISOString(),
    messagePreview: payload.formattedContent,
    targetDestination: destination,
  };
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  return this.createErrorResult(payload, `Network dispatch failed: ${message}`, destination);
}
```

---

### 2. Platform 1: Discord Webhooks (`LIVE-01`)

- **Protocol:** HTTP POST to configured `webhookUrl`.
- **URL Parameter:** Append `?wait=true` to force Discord to respond with the created message object containing `{ id, channel_id }`.
- **Payload Schema:**
  ```json
  {
    "content": "formattedContent markdown string"
  }
  ```
- **Character Limit:** Discord webhook message content max length is 2,000 characters (already handled by template engine).
- **Post URL Resolution:** `https://discord.com/channels/@me/${channel_id}/${id}` or `https://discord.com/channels/${guild_id}/${channel_id}/${id}`. If channel_id is not present, link to `https://discord.com`.

---

### 3. Platform 2: Bluesky AT Protocol (`LIVE-02`)

- **Protocol:** XRPC JSON over HTTPS.
- **Service Endpoint:** `https://bsky.social` (configurable via `config.credentials.service`).
- **Step 1 — Session Creation (`com.atproto.server.createSession`):**
  - Endpoint: `POST ${service}/xrpc/com.atproto.server.createSession`
  - Body: `{ "identifier": identifier, "password": password }`
  - Returns: `{ "accessJwt": string, "did": string, "handle": string }`
- **Step 2 — Record Creation (`com.atproto.repo.createRecord`):**
  - Endpoint: `POST ${service}/xrpc/com.atproto.repo.createRecord`
  - Headers: `Authorization: Bearer ${accessJwt}`, `Content-Type: application/json`
  - Body:
    ```json
    {
      "repo": did,
      "collection": "app.bsky.feed.post",
      "record": {
        "$type": "app.bsky.feed.post",
        "text": payload.formattedContent,
        "createdAt": new Date().toISOString()
      }
    }
    ```
  - Returns: `{ "uri": "at://did:plc:.../app.bsky.feed.post/3kn4...", "cid": "..." }`
- **Post URL Resolution:** `https://bsky.app/profile/${handle}/post/${rkey}` where `rkey` is the final URI path component (`uri.split('/').pop()`).

---

### 4. Platform 3: Reddit API (`LIVE-03`)

- **Protocol:** OAuth2 Password Grant + REST API.
- **Strict Requirement:** Reddit requires a custom `User-Agent` header on all requests (e.g. `ReferralRepeater/1.0.0 (by /u/${username})`). Using default or empty user agents results in immediate HTTP 429/403.
- **Step 1 — OAuth2 Access Token:**
  - Endpoint: `POST https://www.reddit.com/api/v1/access_token`
  - Headers:
    - `Authorization: Basic ${Buffer.from(clientId + ':' + clientSecret).toString('base64')}`
    - `Content-Type: application/x-www-form-urlencoded`
    - `User-Agent: ${userAgent}`
  - Body: `grant_type=password&username=${username}&password=${password}`
  - Returns: `{ "access_token": string, "token_type": "bearer", "expires_in": number }`
- **Step 2 — Submit Post or Comment:**
  - **Self/Link Post (`POST https://oauth.reddit.com/api/submit`):**
    - Body params: `api_type=json&sr=${target.name}&kind=self&title=${encodeURIComponent(payload.title)}&text=${encodeURIComponent(payload.formattedContent)}` (plus optional `flair_id`).
    - Returns JSON: `{ "json": { "data": { "id": "t3_abc123", "url": "https://www.reddit.com/r/.../comments/..." } } }`
  - **Comment (`POST https://oauth.reddit.com/api/comment`):**
    - If `target.type === 'comment'` and target identifier / thread ID is specified.
    - Body params: `api_type=json&thing_id=${target.thingId || target.name}&text=${encodeURIComponent(payload.formattedContent)}`
  - **API Error Handling:** Reddit often returns HTTP 200 with `{ "json": { "errors": [["RATELIMIT", ...]] } }`. The adapter must inspect `json.errors` and fail if non-empty.

---

### 5. Platform 4: Twitter / X API v2 (`LIVE-04`)

- **Protocol:** Twitter API v2 Tweet Creation with OAuth 1.0a User Context.
- **Endpoint:** `POST https://api.twitter.com/2/tweets`
- **Payload Schema:** `{ "text": payload.formattedContent }`
- **OAuth 1.0a Signature Algorithm (HMAC-SHA1 via `node:crypto`):**
  1. Generate `oauth_nonce` (`crypto.randomBytes(16).toString('hex')`) and `oauth_timestamp` (`Math.floor(Date.now() / 1000)`).
  2. Assemble parameter map: `oauth_consumer_key`, `oauth_nonce`, `oauth_signature_method="HMAC-SHA1"`, `oauth_timestamp`, `oauth_token`, `oauth_version="1.0"`.
  3. Percent-encode keys and values according to RFC 3986 (important: encode `!*()'`).
  4. Sort parameters alphabetically by key.
  5. Concatenate into parameter string: `k1=v1&k2=v2...`.
  6. Signature base string: `POST&` + `encodeURIComponent("https://api.twitter.com/2/tweets")` + `&` + `encodeURIComponent(parameterString)`.
  7. Signing key: `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`.
  8. Calculate HMAC-SHA1 and base64 encode to produce `oauth_signature`.
  9. Assemble `Authorization: OAuth oauth_consumer_key="...", oauth_nonce="...", ...`.
- **Post URL Resolution:** `https://x.com/i/web/status/${tweetId}`.

---

### 6. Platform 5: Facebook Graph API (`LIVE-05`)

- **Protocol:** Meta Graph API v19.0.
- **Target Resolution:**
  - Page / Feed: `POST https://graph.facebook.com/v19.0/${target.id}/feed`
  - If `target.id === 'feed'` or `'me'`, route to `https://graph.facebook.com/v19.0/me/feed`.
- **Payload Parameters:**
  - `message`: `payload.formattedContent`
  - `link`: `payload.referralLink.url`
  - `access_token`: `config.credentials.accessToken`
- **Response:** `{ "id": "123456_7891011" }`
- **Post URL Resolution:** `https://www.facebook.com/${data.id}`.

---

## Failure Modes & Mitigations

| Failure Mode | Platform Affected | Root Cause | Adapter Mitigation |
|--------------|-------------------|------------|-------------------|
| **Invalid Credentials** | All | Expired token, revoked app password, incorrect secret | `validateCredentials()` pre-check fails fast; HTTP 401/403 responses caught and converted to descriptive `PostResult` error. |
| **Network Timeout / Hang** | All | Socket hangup, slow DNS, provider outage | `AbortSignal.timeout(10000)` cancels fetch after 10 seconds; caught as `AbortError`/`TimeoutError` and returned as `PostResult` error. |
| **Offline / DNS Failure** | All | Disconnected machine, network down (`ENOTFOUND`, `ECONNREFUSED`) | Native fetch throws `TypeError`; caught in try/catch and returned as `PostResult` error without unhandled rejection. |
| **Rate Limit (HTTP 429)** | Discord, Twitter, Reddit, Bluesky | Frequent dispatches exceeding tier limits | Catch HTTP 429, extract `Retry-After` header if present, and return structured error informing user of platform cooldown. |
| **Reddit In-Body Errors** | Reddit | Reddit returns HTTP 200 with `{ json: { errors: [...] } }` | Validate `json.errors.length === 0` even on HTTP 200 responses. |
| **Formatting / Character Overflow** | Twitter (280), Bluesky (300) | Long text rejected by platform API | Template engine handles length budgets; if API still returns 400 Bad Request, structured error captures error message. |

---

## Validation Architecture

### Nyquist Compliance & Sampling Strategy

- **Test Infrastructure:** Vitest `3.0.6` with `vitest.config.ts`.
- **Execution Speed:** Full test suite execution takes ~3.5 seconds.
- **Mocking Protocol:**
  - Use `vi.spyOn(globalThis, 'fetch')` to intercept outgoing HTTP calls in unit tests.
  - Assert correct HTTP method, endpoint URLs, headers (OAuth 1.0a Authorization, Bearer JWT, Reddit User-Agent, Basic auth), and JSON/URL-encoded bodies.
  - Test simulated failures: simulate network drop (`fetch.mockRejectedValue(new TypeError('Failed to fetch'))`), timeout (`AbortError`), HTTP 401, HTTP 429 rate limit, and malformed responses.
  - Ensure 100% of adapters tested in both `dryRun: true` (simulated, no fetch calls made) and `dryRun: false` (network dispatch executed).

---

## Wave Decomposition & Planning Recommendations

Phase 2 decomposes cleanly into 2 sequential execution plans:

- **Plan 02-01: Core Webhook & REST Adapters (Discord, Bluesky, Facebook) + OAuth 1.0a Helper**
  - Implement live dispatch for `DiscordAdapter` (`LIVE-01`).
  - Implement live session & record dispatch for `BlueskyAdapter` (`LIVE-02`).
  - Implement live Graph API dispatch for `FacebookAdapter` (`LIVE-05`).
  - Create reusable `OAuth1Signer` utility in `src/platforms/oauth1.ts` with unit tests for Twitter.
  - Implement defensive error handling and timeout wrapping (`LIVE-06`).
  - Update `tests/platforms.test.ts` with live mock tests for Discord, Bluesky, and Facebook.

- **Plan 02-02: Authenticated Protocol Adapters (Reddit OAuth2, Twitter/X API v2) & Full Resilience Suite**
  - Implement OAuth2 token exchange and post/comment dispatch in `RedditAdapter` (`LIVE-03`).
  - Implement v2 tweet creation with OAuth 1.0a signature in `TwitterAdapter` (`LIVE-04`).
  - Comprehensive negative and resilience testing across all 5 adapters verifying `LIVE-06` (timeouts, 401s, 429 rate limits, DNS offline failures).

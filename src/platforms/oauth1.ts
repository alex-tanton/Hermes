import crypto from 'node:crypto';

export interface OAuth1Credentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

export interface OAuth1Request {
  method: string;
  url: string;
  params?: Record<string, string>;
}

export interface OAuth1Options {
  nonce?: string;
  timestamp?: string;
}

/**
 * Encodes characters per RFC 3986 specifications (including !'()*).
 */
export function rfc3986Encode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Normalizes a URL for OAuth 1.0a base string per RFC 5849 §3.4.1.2.
 */
export function normalizeUrl(urlStr: string): string {
  const parsed = new URL(urlStr);
  const protocol = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  const port = parsed.port;

  let portPart = '';
  if (
    port &&
    !((protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443'))
  ) {
    portPart = `:${port}`;
  }

  return `${protocol}//${host}${portPart}${parsed.pathname}`;
}

/**
 * Generates an RFC 5849 compliant OAuth 1.0a Authorization header.
 * Uses Node.js built-in crypto module without third-party dependencies.
 */
export function generateOAuth1Header(
  request: OAuth1Request,
  creds: OAuth1Credentials,
  options?: OAuth1Options,
): string {
  const nonce = options?.nonce ?? crypto.randomBytes(16).toString('hex');
  const timestamp = options?.timestamp ?? Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  // Extract query params from URL if present
  const parsedUrl = new URL(request.url);
  const allParams: Array<{ key: string; value: string; encodedKey: string; encodedValue: string }> =
    [];

  parsedUrl.searchParams.forEach((value, key) => {
    allParams.push({
      key,
      value,
      encodedKey: rfc3986Encode(key),
      encodedValue: rfc3986Encode(value),
    });
  });

  if (request.params) {
    for (const [key, value] of Object.entries(request.params)) {
      allParams.push({
        key,
        value,
        encodedKey: rfc3986Encode(key),
        encodedValue: rfc3986Encode(value),
      });
    }
  }

  for (const [key, value] of Object.entries(oauthParams)) {
    allParams.push({
      key,
      value,
      encodedKey: rfc3986Encode(key),
      encodedValue: rfc3986Encode(value),
    });
  }

  // Sort lexicographically by encoded key, then by encoded value per RFC 5849 §3.4.1.3.2
  allParams.sort((a, b) => {
    if (a.encodedKey === b.encodedKey) {
      return a.encodedValue.localeCompare(b.encodedValue);
    }
    return a.encodedKey.localeCompare(b.encodedKey);
  });

  const parameterString = allParams.map((p) => `${p.encodedKey}=${p.encodedValue}`).join('&');
  const baseUrl = normalizeUrl(request.url);
  const signatureBaseString = `${request.method.toUpperCase()}&${rfc3986Encode(baseUrl)}&${rfc3986Encode(parameterString)}`;

  const signingKey = `${rfc3986Encode(creds.apiSecret)}&${rfc3986Encode(creds.accessSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  const headerParams = [
    'oauth_consumer_key',
    'oauth_nonce',
    'oauth_signature',
    'oauth_signature_method',
    'oauth_timestamp',
    'oauth_token',
    'oauth_version',
  ];

  const headerValues = headerParams
    .map((k) => `${k}="${rfc3986Encode(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerValues}`;
}

import { PlatformType, PostPayload, PostResult } from '../types/index.js';

export interface AdapterOptions {
  dryRun?: boolean;
}

export abstract class BasePlatformAdapter {
  public abstract readonly name: PlatformType;
  protected dryRun: boolean;

  constructor(options: AdapterOptions = {}) {
    this.dryRun = options.dryRun ?? true;
  }

  public setDryRun(dryRun: boolean): void {
    this.dryRun = dryRun;
  }

  public isDryRun(): boolean {
    return this.dryRun;
  }

  /**
   * Validates whether necessary credentials are configured
   */
  public abstract validateCredentials(): { valid: boolean; reason?: string };

  /**
   * Posts content to the platform or simulates the post in dry-run mode
   */
  public abstract post(
    payload: PostPayload,
    options?: { dryRun?: boolean; target?: string },
  ): Promise<PostResult>;

  /**
   * Standardized simulator response generator
   */
  protected createSimulatedResult(payload: PostPayload, targetDestination?: string): PostResult {
    const simId = `sim_${this.name}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      platform: this.name,
      linkId: payload.referralLink.id,
      postId: simId,
      postUrl: `https://mock.${this.name}.com/post/${simId}`,
      simulated: true,
      timestamp: new Date().toISOString(),
      messagePreview: payload.formattedContent,
      targetDestination: targetDestination || 'default',
    };
  }

  /**
   * Standardized error result generator
   */
  protected createErrorResult(
    payload: PostPayload,
    error: string,
    targetDestination?: string,
  ): PostResult {
    return {
      success: false,
      platform: this.name,
      linkId: payload.referralLink.id,
      simulated: false,
      timestamp: new Date().toISOString(),
      messagePreview: payload.formattedContent,
      targetDestination,
      error,
    };
  }

  /**
   * Standardized success result generator for live dispatches
   */
  protected createSuccessResult(
    payload: PostPayload,
    details: { postId?: string; postUrl?: string; targetDestination?: string },
  ): PostResult {
    return {
      success: true,
      platform: this.name,
      linkId: payload.referralLink.id,
      postId: details.postId,
      postUrl: details.postUrl,
      simulated: false,
      timestamp: new Date().toISOString(),
      messagePreview: payload.formattedContent,
      targetDestination: details.targetDestination,
    };
  }

  /**
   * Extracts clean error string from fetch response
   */
  protected async extractErrorMessage(res: Response): Promise<string> {
    try {
      const data = (await res.json()) as Record<string, unknown>;
      const errObj =
        typeof data.error === 'object' && data.error !== null
          ? (data.error as Record<string, unknown>)
          : null;
      const msg =
        data.message ||
        errObj?.message ||
        data.detail ||
        errObj?.detail ||
        (typeof data.error === 'string' ? data.error : null) ||
        (Array.isArray(data.errors)
          ? data.errors
              .map((e: unknown) =>
                typeof e === 'object' && e !== null
                  ? (e as { message?: string; detail?: string }).message ||
                    (e as { message?: string; detail?: string }).detail ||
                    JSON.stringify(e)
                  : String(e),
              )
              .join('; ')
          : null);
      if (typeof msg === 'string') return msg;
      if (msg) return JSON.stringify(msg);
    } catch {
      const text = await res.text().catch(() => '');
      if (text) return text;
    }
    return `HTTP ${res.status}`;
  }

  /**
   * Standardized catch block formatter for network timeouts and errors
   */
  protected formatCatchError(err: unknown, service: string, timeoutMs = 10000): string {
    const isTimeout =
      err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return isTimeout
      ? `${service} request timed out after ${timeoutMs}ms`
      : `${service} API request failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

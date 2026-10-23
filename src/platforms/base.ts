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
}

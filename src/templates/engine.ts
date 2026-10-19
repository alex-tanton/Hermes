import {
  PlatformType,
  PostPayload,
  ReferralLink,
  PersonalTouchConfig,
  ToneType,
} from '../types/index.js';
import { programRegistry } from '../programs/registry.js';

export interface RenderOptions {
  platform: PlatformType;
  referralLink: ReferralLink;
  personalTouch: PersonalTouchConfig;
  tone?: ToneType;
}

/**
 * Calculates effective Twitter character length where all URLs count as fixed 23 characters (t.co standard)
 */
export function calculateTwitterLength(text: string): number {
  return text.replace(/https?:\/\/[^\s]+/g, 'x'.repeat(23)).length;
}

export class TemplateEngine {
  /**
   * Generates a tailored PostPayload for a given platform and referral link
   */
  public render(options: RenderOptions): PostPayload {
    const { platform, referralLink, personalTouch, tone = 'story' } = options;
    const program = programRegistry.get(referralLink.category);

    const title = this.buildTitle(referralLink, tone);
    const anecdote = this.resolveAnecdote(referralLink, personalTouch);
    const tags = this.resolveTags(referralLink, program.recommendedHashtags);
    const disclosure = personalTouch.includeFtcDisclosure ? program.defaultDisclosure : '';

    const body = this.buildBody({
      platform,
      referralLink,
      anecdote,
      disclosure,
      tags,
      tone,
      authorName: personalTouch.authorName,
    });

    const formattedContent = this.formatForPlatform(platform, {
      title,
      body,
      url: referralLink.url,
      tags,
      disclosure,
    });

    return {
      platform,
      referralLink,
      title,
      body,
      formattedContent,
      tags,
      tone,
    };
  }

  private resolveAnecdote(link: ReferralLink, personalTouch: PersonalTouchConfig): string {
    if (link.personalAnecdote && link.personalAnecdote.trim().length > 0) {
      return link.personalAnecdote.trim();
    }
    if (personalTouch.defaultAnecdote && personalTouch.defaultAnecdote.trim().length > 0) {
      return personalTouch.defaultAnecdote.trim();
    }
    return 'I personally recommend this offer based on its proven value and great bonus reward.';
  }

  private resolveTags(link: ReferralLink, defaultHashtags: string[]): string[] {
    const linkTags = link.tags?.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)) ?? [];
    return Array.from(new Set([...linkTags, ...defaultHashtags]));
  }

  private buildTitle(link: ReferralLink, tone: ToneType): string {
    switch (tone) {
      case 'deal_alert':
        return `🔥 ${link.name} Welcome Offer: ${link.bonusSummary}`;
      case 'informative':
        return `[Review & Bonus] ${link.name} — Current Welcome Offer & Value Breakdown`;
      case 'comparison':
        return `Why the ${link.name} is one of my top recommended cards: ${link.bonusSummary}`;
      case 'story':
      default:
        return `My experience with the ${link.name} (+ ${link.bonusSummary})`;
    }
  }

  private buildBody(params: {
    platform: PlatformType;
    referralLink: ReferralLink;
    anecdote: string;
    disclosure: string;
    tags: string[];
    tone: ToneType;
    authorName: string;
  }): string {
    const { referralLink, anecdote, tone, authorName } = params;

    let leadIn = '';
    switch (tone) {
      case 'deal_alert':
        leadIn = `Looking for high-value rewards? The latest offer on the **${referralLink.name}** is active right now.`;
        break;
      case 'informative':
        leadIn = `Here is a breakdown of the current offer for the **${referralLink.name}** by ${referralLink.provider}.`;
        break;
      case 'comparison':
        leadIn = `If you're evaluating rewards cards this month, the **${referralLink.name}** stands out with strong perks and return on spend.`;
        break;
      case 'story':
      default:
        leadIn = `Hey everyone! Wanted to share some feedback on the **${referralLink.name}**.`;
        break;
    }

    return [
      leadIn,
      '',
      `**Welcome Offer:** ${referralLink.bonusSummary}`,
      '',
      `**Personal Experience:** ${anecdote}`,
      '',
      `Feel free to use my referral link if you are planning to apply or try it out:`,
      `${referralLink.url}`,
      '',
      `Cheers,\n${authorName}`,
    ].join('\n');
  }

  /**
   * Adapts text length, formatting syntax, and layout for specific platform constraints
   */
  public formatForPlatform(
    platform: PlatformType,
    parts: {
      title: string;
      body: string;
      url: string;
      tags: string[];
      disclosure: string;
    },
  ): string {
    const { title, body, url, tags, disclosure } = parts;

    switch (platform) {
      case 'twitter': {
        // Twitter limit: 280 chars, URLs count as fixed 23 chars (t.co standard)
        return this.fitToLength({
          primaryText: title,
          url,
          disclosure: disclosure ? ' #ad' : '',
          tags: tags.slice(0, 2).join(' '),
          maxLength: 280,
          urlLengthWeight: 23,
        });
      }

      case 'bluesky': {
        // Bluesky limit: 300 chars
        return this.fitToLength({
          primaryText: `${title}\n${body.split('\n')[0]}`,
          url,
          disclosure: disclosure ? ' (Ad/Ref)' : '',
          tags: tags.slice(0, 2).join(' '),
          maxLength: 300,
        });
      }

      case 'discord': {
        // Discord: supports rich markdown, mentions, clean blocks (up to 2000 chars)
        const lines = [`**${title}**`, '', body, '', disclosure ? `*${disclosure}*` : ''].filter(
          Boolean,
        );
        return lines.join('\n');
      }

      case 'reddit': {
        // Reddit: Markdown formatting
        const lines = [
          `### ${title}`,
          '',
          body,
          '',
          `---`,
          disclosure ? `*${disclosure}*` : '',
        ].filter(Boolean);
        return lines.join('\n');
      }

      case 'facebook': {
        // Facebook: clean conversational text, no markdown syntax (# or *)
        const cleanBody = body.replace(/\*\*(.*?)\*\*/g, '$1').replace(/###/g, '');
        const cleanTitle = title.replace(/(?:🔥|✨|🛍️|💰|🍽️|🎁)/gu, '').trim();
        const lines = [cleanTitle, '', cleanBody, '', disclosure].filter(Boolean);
        return lines.join('\n');
      }

      default:
        return `${title}\n\n${body}\n\n${disclosure}`;
    }
  }

  /**
   * Intelligently truncates text to fit within short platform character budgets
   */
  private fitToLength(params: {
    primaryText: string;
    url: string;
    disclosure: string;
    tags: string;
    maxLength: number;
    urlLengthWeight?: number;
  }): string {
    const { primaryText, url, disclosure, tags, maxLength, urlLengthWeight } = params;
    const effectiveUrlLength = urlLengthWeight !== undefined ? urlLengthWeight : url.length;
    const nonUrlSuffix = `${disclosure} ${tags}`.trim();
    // newline (1) + effectiveUrlLength + optional space/text
    const suffixBudget = 1 + effectiveUrlLength + (nonUrlSuffix ? 1 + nonUrlSuffix.length : 0);
    const availableForText = maxLength - suffixBudget - 4; // safety buffer

    let fittedText = primaryText;
    if (fittedText.length > availableForText) {
      fittedText = fittedText.substring(0, Math.max(10, availableForText)).trim() + '...';
    }

    const suffix = `\n${url}${disclosure} ${tags}`.trim();
    return `${fittedText}\n${suffix}`.trim();
  }
}

export const templateEngine = new TemplateEngine();

import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../src/templates/engine.js';
import { ReferralLink, PersonalTouchConfig } from '../src/types/index.js';

describe('TemplateEngine', () => {
  const engine = new TemplateEngine();

  const mockLink: ReferralLink = {
    id: 'chase-sapphire',
    enabled: true,
    category: 'credit_card',
    provider: 'Chase',
    name: 'Chase Sapphire Preferred®',
    url: 'https://www.referyourchasecard.com/19y/MSUZXKR6HR',
    bonusSummary: 'Earn 75,000 bonus points after $4,000 in spend.',
    personalAnecdote: 'I used my points for a trip to Tokyo and saved over $2,500 on hotels.',
    tags: ['chase', 'travel', 'sapphire'],
    targetPlatforms: ['reddit', 'twitter', 'bluesky', 'discord', 'facebook'],
  };

  const mockPersonalTouch: PersonalTouchConfig = {
    authorName: 'Alex',
    philosophy: 'Travel hacking changed my life by making dream trips affordable.',
    defaultAnecdote: 'I have used these cards for years to travel affordably.',
    includeFtcDisclosure: true,
    toneRotation: ['story', 'informative', 'deal_alert'],
  };

  it('renders a story tone with personal anecdote injected', () => {
    const payload = engine.render({
      platform: 'reddit',
      referralLink: mockLink,
      personalTouch: mockPersonalTouch,
      tone: 'story',
    });

    expect(payload.title).toContain('My experience with the Chase Sapphire Preferred®');
    expect(payload.body).toContain(mockLink.personalAnecdote);
    expect(payload.body).toContain(mockLink.url);
    expect(payload.body).toContain('Alex');
    expect(payload.formattedContent).toContain('FTC Referral Disclosure');
  });

  it('falls back to default anecdote when link does not provide one', () => {
    const linkWithoutAnecdote: ReferralLink = {
      ...mockLink,
      personalAnecdote: undefined,
    };

    const payload = engine.render({
      platform: 'reddit',
      referralLink: linkWithoutAnecdote,
      personalTouch: mockPersonalTouch,
      tone: 'story',
    });

    expect(payload.body).toContain(mockPersonalTouch.defaultAnecdote);
  });

  it('omits FTC disclosure when includeFtcDisclosure is false', () => {
    const payload = engine.render({
      platform: 'reddit',
      referralLink: mockLink,
      personalTouch: { ...mockPersonalTouch, includeFtcDisclosure: false },
      tone: 'informative',
    });

    expect(payload.formattedContent).not.toContain('FTC Referral Disclosure');
  });

  it('enforces Twitter 280-character limit strictly', () => {
    const payload = engine.render({
      platform: 'twitter',
      referralLink: mockLink,
      personalTouch: mockPersonalTouch,
      tone: 'deal_alert',
    });

    expect(payload.formattedContent.length).toBeLessThanOrEqual(280);
    expect(payload.formattedContent).toContain(mockLink.url);
  });

  it('enforces Bluesky 300-character limit strictly', () => {
    const payload = engine.render({
      platform: 'bluesky',
      referralLink: mockLink,
      personalTouch: mockPersonalTouch,
      tone: 'deal_alert',
    });

    expect(payload.formattedContent.length).toBeLessThanOrEqual(300);
    expect(payload.formattedContent).toContain(mockLink.url);
  });

  it('cleans markdown symbols for Facebook conversational formatting', () => {
    const payload = engine.render({
      platform: 'facebook',
      referralLink: mockLink,
      personalTouch: mockPersonalTouch,
      tone: 'informative',
    });

    // Should not contain markdown bold ** or headers ###
    expect(payload.formattedContent).not.toContain('**');
    expect(payload.formattedContent).not.toContain('###');
  });

  it('generates distinct titles for different tones', () => {
    const dealAlert = engine.render({
      platform: 'discord',
      referralLink: mockLink,
      personalTouch: mockPersonalTouch,
      tone: 'deal_alert',
    });

    const informative = engine.render({
      platform: 'discord',
      referralLink: mockLink,
      personalTouch: mockPersonalTouch,
      tone: 'informative',
    });

    expect(dealAlert.title).toContain('🔥');
    expect(informative.title).toContain('[Review & Bonus]');
  });
});

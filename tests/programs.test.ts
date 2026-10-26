import { describe, it, expect } from 'vitest';
import { programRegistry } from '../src/programs/registry.js';

describe('ProgramRegistry & Extensibility', () => {
  it('contains default registered referral categories', () => {
    const creditCard = programRegistry.get('credit_card');
    expect(creditCard.title).toContain('Credit Cards');
    expect(creditCard.recommendedSubreddits).toContain('churning');
    expect(creditCard.defaultDisclosure).toContain('FTC Referral Disclosure');

    const shopping = programRegistry.get('shopping');
    expect(shopping.title).toContain('Online Shopping');
    expect(shopping.recommendedSubreddits).toContain('coupons');
    expect(shopping.formatBonusSummary('$30 bonus')).toContain('🛍️ Shopping Bonus: $30 bonus');

    const banking = programRegistry.get('banking');
    expect(banking.title).toContain('Banking');

    const dining = programRegistry.get('dining');
    expect(dining.title).toContain('Dining');
  });

  it('falls back to custom category for unknown categories', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallback = programRegistry.get('unknown_category' as any);
    expect(fallback).toBeDefined();
    expect(fallback.category).toBe('custom');
  });

  it('allows registering new custom referral categories', () => {
    programRegistry.register({
      category: 'custom',
      title: 'Crypto Staking & Exchange Referrals',
      description: 'Crypto referral codes for fee discounts and sign up rewards.',
      recommendedSubreddits: ['cryptocurrency', 'referralcodes'],
      recommendedHashtags: ['#Crypto', '#Bitcoin', '#TradingFees'],
      defaultDisclosure: '(Disclosure: Crypto trading referral bonus. Terms apply.)',
      exampleCallToAction: 'Register using this link for 20% trading fee discount:',
      formatBonusSummary: (s) => `⚡ Crypto Offer: ${s}`,
    });

    const updated = programRegistry.get('custom');
    expect(updated.title).toBe('Crypto Staking & Exchange Referrals');
    expect(updated.formatBonusSummary('20% fee rebate')).toBe('⚡ Crypto Offer: 20% fee rebate');
  });

  it('lists all registered programs correctly', () => {
    const programs = programRegistry.listAll();
    expect(programs.length).toBeGreaterThanOrEqual(5); // default categories
    expect(programs.some((p) => p.category === 'credit_card')).toBe(true);
    expect(programs.some((p) => p.category === 'shopping')).toBe(true);
  });
});

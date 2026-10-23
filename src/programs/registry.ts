import { ProgramCategory } from '../types/index.js';
import { ProgramMetadata } from './types.js';

class ProgramRegistry {
  private programs: Map<ProgramCategory, ProgramMetadata> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Credit Cards
    this.register({
      category: 'credit_card',
      title: 'Credit Cards & Travel Rewards',
      description: 'Points, miles, and cashback credit card signup bonuses.',
      recommendedSubreddits: ['churning', 'CreditCards', 'referralcodes'],
      recommendedHashtags: ['#CreditCards', '#TravelHacking', '#PointsAndMiles', '#CashBack'],
      defaultDisclosure:
        '(FTC Referral Disclosure: If you apply using this link and get approved, we may both receive bonus rewards. Terms apply.)',
      exampleCallToAction: 'Check out the current offer and apply here:',
      formatBonusSummary: (s) => `✨ Special Welcome Offer: ${s}`,
    });

    // Online Shopping & Cashback Portals
    this.register({
      category: 'shopping',
      title: 'Online Shopping & Cashback Portals',
      description: 'E-commerce rebates, shopping portals, and checkout coupon bonuses.',
      recommendedSubreddits: ['coupons', 'referralcodes', 'deals', 'frugal'],
      recommendedHashtags: ['#CashBack', '#Deals', '#OnlineShopping', '#CouponCommunity'],
      defaultDisclosure:
        '(Referral Disclosure: New users receive a signup reward; I may receive a referral commission upon qualifying purchase.)',
      exampleCallToAction: 'Claim your shopping welcome bonus here:',
      formatBonusSummary: (s) => `🛍️ Shopping Bonus: ${s}`,
    });

    // Banking & High-Yield Savings
    this.register({
      category: 'banking',
      title: 'Banking & High-Yield Savings',
      description: 'Checking accounts, high yield savings, and investment brokerage referrals.',
      recommendedSubreddits: ['personalfinance', 'referralcodes', 'investing'],
      recommendedHashtags: ['#PersonalFinance', '#HYSA', '#BankingBonus', '#Investing'],
      defaultDisclosure:
        '(Disclosure: Financial referral link. Bonus rewarded upon meeting deposit criteria.)',
      exampleCallToAction: 'Open an account and unlock your deposit bonus:',
      formatBonusSummary: (s) => `💰 Banking Reward: ${s}`,
    });

    // Dining & Food Delivery
    this.register({
      category: 'dining',
      title: 'Dining & Food Delivery',
      description: 'Restaurant dining rewards, grocery delivery, and meal kit referrals.',
      recommendedSubreddits: ['referralcodes', 'FoodDelivery', 'frugal'],
      recommendedHashtags: ['#FoodDelivery', '#DiningRewards', '#MealDeals'],
      defaultDisclosure:
        '(Referral Disclosure: Discount applied at checkout; referral reward earned upon delivery.)',
      exampleCallToAction: 'Get your discount on your next order:',
      formatBonusSummary: (s) => `🍽️ Dining Discount: ${s}`,
    });

    // Custom Generic Program
    this.register({
      category: 'custom',
      title: 'Custom Referral Program',
      description: 'General referral rewards for apps, services, or SaaS platforms.',
      recommendedSubreddits: ['referralcodes', 'promocodes'],
      recommendedHashtags: ['#ReferralCode', '#PromoCode', '#Bonus'],
      defaultDisclosure:
        '(Referral Disclosure: Using this link provides a sign-up incentive and supports the author.)',
      exampleCallToAction: 'Use this referral link to get started:',
      formatBonusSummary: (s) => `🎁 Offer: ${s}`,
    });
  }

  public register(metadata: ProgramMetadata): void {
    this.programs.set(metadata.category, metadata);
  }

  public get(category: ProgramCategory): ProgramMetadata {
    const program = this.programs.get(category);
    if (!program) {
      return this.programs.get('custom')!;
    }
    return program;
  }

  public listAll(): ProgramMetadata[] {
    return Array.from(this.programs.values());
  }
}

export const programRegistry = new ProgramRegistry();

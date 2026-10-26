# Expanding to Other Referral Programs

Hermes is designed to support any referral program category seamlessly.

### Pre-Configured Categories

1. **Credit Cards (`credit_card`)**: Chase, Capital One, American Express, Citi, Discover.
2. **Online Shopping Portals (`shopping`)**: Rakuten, TopCashback, Honey, BeFrugal, Capital One Shopping.
3. **Banking & HYSA (`banking`)**: SoFi, Wealthfront, Marcus, Robinhood.
4. **Dining & Food Delivery (`dining`)**: Uber Eats, DoorDash, Instacart, Grubhub.
5. **Custom Program (`custom`)**: Any app, SaaS, or service referral.

### Programmatic Custom Extension

You can register custom referral program definitions in TypeScript:

```typescript
import { programRegistry, HermesEngine } from 'hermes';

programRegistry.register({
  category: 'custom',
  title: 'Cloud & SaaS Referrals',
  description: 'Hosting credits and SaaS software discounts.',
  recommendedSubreddits: ['webhosting', 'promocodes'],
  recommendedHashtags: ['#CloudHosting', '#SaaSDeals'],
  defaultDisclosure: '(Referral Disclosure: Author receives cloud credits upon signup.)',
  exampleCallToAction: 'Deploy your instance with free credits here:',
  formatBonusSummary: (s) => `☁️ Hosting Offer: ${s}`,
});
```

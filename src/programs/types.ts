import { ProgramCategory } from '../types/index.js';

export interface ProgramMetadata {
  category: ProgramCategory;
  title: string;
  description: string;
  recommendedSubreddits: string[];
  recommendedHashtags: string[];
  defaultDisclosure: string;
  exampleCallToAction: string;
  formatBonusSummary: (summary: string) => string;
}

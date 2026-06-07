import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { app_config, DEFAULT_RANK_CRITERIA, RankCriteria } from '../db/schema';

export interface AppConfig {
  linkedin_max_posts: number;
  linkedin_posted_limit: string;
  google_news_max_results: number;
  collector_max_classifications: number;
  rank_criteria: RankCriteria;
}

const DEFAULTS: AppConfig = {
  linkedin_max_posts: 25,
  linkedin_posted_limit: 'week',
  google_news_max_results: 20,
  collector_max_classifications: 30,
  rank_criteria: DEFAULT_RANK_CRITERIA,
};

/** Fetch global app config. Falls back to hardcoded defaults on any error. */
export async function getAppConfig(): Promise<AppConfig> {
  try {
    const [cfg] = await db.select().from(app_config).where(eq(app_config.id, 1));
    if (!cfg) return DEFAULTS;
    return {
      linkedin_max_posts: cfg.linkedin_max_posts,
      linkedin_posted_limit: cfg.linkedin_posted_limit,
      google_news_max_results: cfg.google_news_max_results,
      collector_max_classifications: cfg.collector_max_classifications,
      rank_criteria: cfg.rank_criteria ?? DEFAULT_RANK_CRITERIA,
    };
  } catch {
    return DEFAULTS;
  }
}

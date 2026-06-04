import { runActorSync } from './apifyClient';
import { mapLinkedInPost, LINKEDIN_POST_ACTOR } from './apifyLinkedIn';
import { SourceArticle } from './types';

type LiPost = Record<string, unknown>;

function toCompanyUrl(companyLinkedinId: string): string {
  const id = companyLinkedinId.trim();
  if (id.startsWith('http')) return id;
  return `https://www.linkedin.com/company/${id}`;
}

/**
 * Company-page posts: everything authored by the company. Marked prefiltered
 * (by definition on-topic, so no token pre-filter is applied).
 */
export async function fetchCompanyPagePosts(companyLinkedinId: string, lookbackDays?: number, limit = 25): Promise<SourceArticle[]> {
  const postedLimit = (!lookbackDays || lookbackDays <= 7) ? 'week' : 'month';
  const items = await runActorSync<LiPost>(LINKEDIN_POST_ACTOR, {
    authorUrls: [toCompanyUrl(companyLinkedinId)],
    maxPosts: limit,
    postedLimit,
    sortBy: 'date',
    profileScraperMode: 'short',
    startPage: 1,
  });
  return items
    .map((p) => mapLinkedInPost(p, 'linkedin_company', true))
    .filter((a): a is SourceArticle => a !== null);
}

import type { MetadataRoute } from 'next';
import { topics } from '@/data/portfolio';
import { site } from '@/data/site';
export const dynamic = 'force-static';
export default function sitemap(): MetadataRoute.Sitemap { return [{ url: site.url, priority: 1 }, ...topics.map((topic) => ({ url: `${site.url}/explore/${topic.slug}/`, priority: topic.kind === 'overview' ? 0.8 : 0.6 }))]; }

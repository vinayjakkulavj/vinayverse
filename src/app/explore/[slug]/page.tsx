import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { topics, topicAliases, getTopic, getWorld } from '@/data/portfolio';
import ContentView from '@/components/ContentView';
import VisitTracker from '@/components/VisitTracker';

export const dynamicParams = false;
export function generateStaticParams() { return [...topics.map((topic) => topic.slug), ...Object.keys(topicAliases)].map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) return {};
  return { title: topic.title, description: topic.description, alternates: { canonical: `/explore/${topic.slug}/` }, openGraph: { title: `${topic.title} · Vinay Jakkula`, description: topic.description, url: `/explore/${topic.slug}/` } };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();
  const world = getWorld(topic.world);
  const related = world.topics.map((id) => getTopic(id)).filter((value): value is NonNullable<typeof value> => !!value && value.slug !== topic.slug);
  return <><VisitTracker slug={topic.slug}/><ContentView topic={topic} related={related}/></>;
}

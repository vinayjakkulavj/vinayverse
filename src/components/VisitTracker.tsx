'use client';
import { useEffect } from 'react';
import { useExperience } from './ExperienceProvider';
export default function VisitTracker({ slug }: { slug: string }) {
  const { markVisited } = useExperience();
  useEffect(() => { markVisited(slug); }, [slug, markVisited]);
  return null;
}

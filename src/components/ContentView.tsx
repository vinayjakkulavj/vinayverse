import type { CSSProperties } from "react";
import Link from "next/link";
import { getWorld, type Topic } from "@/data/portfolio";
import { professionalResume } from "@/data/resume";
import ProfessionalResumeContent, { type ProfessionalResumeSection } from "./ProfessionalResumeContent";
import UniverseLink from "./UniverseLink";
import styles from "./ContentView.module.css";

type ContentViewProps = { topic: Topic; related: Topic[] };

function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" className={back ? styles.backArrow : styles.arrow}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TopicLinks({ topics }: { topics: Topic[] }) {
  return (
    <ul className={styles.topicList}>
      {topics.map((item, index) => (
        <li key={item.slug}>
          <Link className={styles.topicLink} href={`/explore/${item.slug}`}>
            <span className={styles.topicNumber}>{String(index + 1).padStart(2, "0")}</span>
            <div className={styles.topicCopy}>
              <span className={styles.topicEyebrow}>{item.eyebrow}</span>
              <h3>{item.title}</h3>
              {item.description && <p>{item.description}</p>}
              {item.world !== "professional" && item.status && <span className={styles.cardStatus}>{item.status}</span>}
            </div>
            <Arrow />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ContentView({ topic, related }: ContentViewProps) {
  const world = getWorld(topic.world);
  const isOverview = topic.kind === "overview";
  const isProfessional = topic.world === "professional";
  const professionalSection: ProfessionalResumeSection | undefined = topic.slug === "experience" || topic.slug === "skills" || topic.slug === "achievements" ? topic.slug : undefined;
  const description = isProfessional ? (isOverview ? professionalResume.summary : "") : topic.description;
  const chapters = topic.sections;
  const nearbyTopics = related.filter((item) => item.slug !== topic.slug);
  const accentStyle = { "--world-accent": world.color } as CSSProperties;

  return (
    <main id="main-content" className={[styles.page, isOverview && styles.overview].filter(Boolean).join(" ")} data-world={topic.world} style={accentStyle}>
      <div className={styles.starField} aria-hidden="true" />
      <div className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <UniverseLink href={`/?world=${topic.world}`} className={styles.orbitLink}><Arrow back />Return to orbit</UniverseLink>
          <span className={styles.breadcrumbSeparator} aria-hidden="true">/</span>
          {isOverview ? <span aria-current="page">{world.title}</span> : <Link href={`/explore/${world.slug}`}>{world.title}</Link>}
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrowRow}>
              <span className={styles.worldDot} aria-hidden="true" />
              <p className={styles.eyebrow}>{topic.eyebrow}</p>
              {!isProfessional && topic.status && <span className={styles.status}>{topic.status}</span>}
            </div>
            <h1>{topic.title}</h1>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {isOverview ? (
            <div className={styles.orbitalDetail} aria-hidden="true">
              <span className={styles.orbitalRing} /><span className={styles.orbitalCore} />
              <span className={styles.orbitalMoonOne} /><span className={styles.orbitalMoonTwo} />
              <span className={styles.orbitalMoonThree} />{world.topics.length > 3 && <span className={styles.orbitalMoonFour} />}
              <span className={styles.orbitalLabel}>{world.title}</span>
            </div>
          ) : !isProfessional && chapters.length > 0 ? (
            <nav className={styles.chapterNav} aria-label="On this page">
              <p className={styles.smallLabel}>On this page</p>
              <ol>
                {chapters.map((section, index) => (
                  <li key={`${section.title}-${index}`}>
                    <a href={`#chapter-${index + 1}`}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
        </header>

        {isOverview && nearbyTopics.length > 0 && (
          <section className={styles.exploreSection} aria-labelledby="explore-heading">
            <div className={styles.sectionLabelRow}>
              <h2 id="explore-heading">In this world</h2>
              <span>{String(nearbyTopics.length).padStart(2, "0")} destinations</span>
            </div>
            <TopicLinks topics={nearbyTopics} />
          </section>
        )}

        {isProfessional && <ProfessionalResumeContent section={professionalSection} />}

        {!isProfessional && chapters.length > 0 && (
          <div className={styles.story}>
            {chapters.map((section, index) => (
              <section className={styles.chapter} id={`chapter-${index + 1}`} aria-labelledby={`chapter-heading-${index + 1}`} key={`${section.title}-${index}`}>
                <div className={styles.chapterCue}>
                  <span className={styles.chapterNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.chapterRule} aria-hidden="true" />
                </div>
                <div className={styles.chapterCopy}>
                  <h2 id={`chapter-heading-${index + 1}`}>{section.title}</h2>
                  {section.body && section.body.split(/\n\s*\n/).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
                  {section.items && section.items.length > 0 && (
                    <ul className={styles.chapterItems}>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        {!isProfessional && topic.quote && (
          <figure className={styles.quote}>
            <span className={styles.quoteMark} aria-hidden="true">“</span>
            <blockquote><p>{topic.quote}</p></blockquote>
            <figcaption>A thought from {world.title}</figcaption>
          </figure>
        )}

        {!isOverview && nearbyTopics.length > 0 && (
          <section className={styles.relatedSection} aria-labelledby="related-heading">
            <div className={styles.sectionLabelRow}>
              <h2 id="related-heading">Keep exploring</h2>
              <Link href={`/explore/${world.slug}`}>{world.title}<Arrow /></Link>
            </div>
            <TopicLinks topics={nearbyTopics} />
          </section>
        )}

        <footer className={styles.footer}>
          <span className={styles.footerWorld}><span className={styles.worldDot} aria-hidden="true" />{world.title}</span>
          <UniverseLink href={`/?world=${topic.world}`} className={styles.orbitLink}><Arrow back />Return to orbit</UniverseLink>
        </footer>
      </div>
    </main>
  );
}

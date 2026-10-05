import { professionalResume } from '@/data/resume';
import styles from './ProfessionalResumeContent.module.css';

export type ProfessionalResumeSection = 'experience' | 'skills' | 'achievements';

type ProfessionalResumeContentProps = { section?: ProfessionalResumeSection };

export default function ProfessionalResumeContent({ section }: ProfessionalResumeContentProps) {
  return <div className={styles.resumeContent} data-overview={!section}>
    {(!section || section === 'experience') && <section className={styles.resumeSection} id="resume-experience" aria-labelledby={!section ? 'resume-experience-heading' : undefined} aria-label={section ? 'Experience' : undefined}>
      {!section && <h2 className={styles.sectionHeading} id="resume-experience-heading">Experience</h2>}
      <div className={styles.sectionContent}>
        {professionalResume.experience.map((job, index) => <article className={styles.job} key={`${job.title}-${job.period}`} aria-labelledby={`resume-job-${index + 1}`}>
          <header className={styles.jobHeader}>
            <h3 id={`resume-job-${index + 1}`}>{job.title}</h3>
            <p className={styles.period}>{job.period}</p>
          </header>
          <ul className={styles.items}>{job.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
        </article>)}
      </div>
    </section>}

    {(!section || section === 'skills') && <section className={styles.resumeSection} id="resume-skills" aria-labelledby={!section ? 'resume-skills-heading' : undefined} aria-label={section ? 'Skills' : undefined}>
      {!section && <h2 className={styles.sectionHeading} id="resume-skills-heading">Skills</h2>}
      <dl className={`${styles.sectionContent} ${styles.skills}`}>
        {professionalResume.skills.map((skill) => <div className={styles.skillRow} key={skill.title}>
          <dt>{skill.title}</dt>
          <dd>{skill.body}</dd>
        </div>)}
      </dl>
    </section>}

    {(!section || section === 'achievements') && <section className={styles.resumeSection} id="resume-achievements" aria-labelledby={!section ? 'resume-achievements-heading' : undefined} aria-label={section ? 'Achievements' : undefined}>
      {!section && <h2 className={styles.sectionHeading} id="resume-achievements-heading">Achievements</h2>}
      <ul className={`${styles.sectionContent} ${styles.items} ${styles.achievements}`}>
        {professionalResume.achievements.map((achievement, index) => <li key={index}>{achievement}</li>)}
      </ul>
    </section>}
  </div>;
}

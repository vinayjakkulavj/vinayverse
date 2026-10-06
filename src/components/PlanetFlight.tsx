import type { CSSProperties } from 'react';
import styles from './PlanetFlight.module.css';

export default function PlanetFlight({ color, title }: { color: string; title: string }) {
  return <div className={styles.flight} style={{ '--atmosphere-color': color } as CSSProperties} aria-hidden="true">
    <div className={styles.haze} />
    <div className={styles.horizon} />
    <svg className={styles.streams} viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
      <g>
        {Array.from({ length: 32 }, (_, index) => {
          const angle = index * Math.PI * 2 / 32 + .07;
          const distance = 190 + (index % 7) * 37;
          return <line key={index} x1={600 + Math.cos(angle) * distance} y1={450 + Math.sin(angle) * distance} x2={600 + Math.cos(angle) * (distance + 45 + index % 4 * 35)} y2={450 + Math.sin(angle) * (distance + 45 + index % 4 * 35)} />;
        })}
      </g>
    </svg>
    <div className={styles.depth} />
    <p className={styles.caption}>Entering {title}<span>Through the atmosphere</span></p>
  </div>;
}

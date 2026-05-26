'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { toolCatalogList } from '../../lib/toolCatalog';
import { homeOperationsEducationList } from '../../lib/home/homeEducationalCopy';
import { SectionHeader } from '../ui/ragtag/SectionHeader';
import { LearningHomeCard } from './LearningHomeCard';
import { HomeConceptCards } from './HomeConceptCards';
import { HomeEducationExpandable } from './HomeEducationExpandable';
import { HomeOperationsTilesGrid } from './HomeOperationsTilesGrid';
import { HomeToolTilesGrid } from './HomeToolTilesGrid';

export function HomeDashboardHub() {
  const reduceMotion = useReducedMotion();
  const toolCount = toolCatalogList().length;
  const opsCount = homeOperationsEducationList().length;

  return (
    <motion.div
      className="space-y-4 pb-0.5 pt-0.5"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
    >
      <LearningHomeCard />
      <HomeConceptCards />

      <section aria-labelledby="home-tools-heading">
        <SectionHeader title={`Tools (${toolCount})`} accent="cyan" />
        <p className="mb-2 font-mono text-[10px] leading-snug text-rt-ice/60">
          Structured applications you can open directly or run in the context of a project.
        </p>
        <HomeToolTilesGrid />
      </section>

      <section aria-labelledby="home-operations-heading">
        <SectionHeader title={`Operations (${opsCount})`} accent="yellow" />
        <p className="mb-2 font-mono text-[10px] leading-snug text-rt-ice/60">
          Projects, knowledge, outputs, oversight, and platform health.
        </p>
        <HomeOperationsTilesGrid />
      </section>

      <HomeEducationExpandable />
    </motion.div>
  );
}

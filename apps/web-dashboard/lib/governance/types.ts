export type GovernanceSourceRef = {
  path: string;
  symbol?: string;
  note?: string;
};

export type GovernanceTableColumn = {
  key: string;
  header: string;
};

export type GovernanceTable = {
  columns: GovernanceTableColumn[];
  rows: Record<string, string>[];
};

export type GovernanceSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  tables?: GovernanceTable[];
  sourceRefs?: GovernanceSourceRef[];
};

export type GovernanceKnownIssue = {
  issue: string;
  whyItMatters: string;
  mitigationToday: string;
};

export type GovernanceDoc = {
  title: string;
  lastVerifiedFromCode: string;
  heroSummary: string[];
  quickLinks: { href: string; label: string }[];
  sections: GovernanceSection[];
  knownIssues: GovernanceKnownIssue[];
};

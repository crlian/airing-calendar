export type ChangelogEntry = {
  date: string;
  title: string;
};

export const changelogEntries: ChangelogEntry[] = [
  {
    date: "Jan 26, 2026",
    title: "Added a lightweight feedback bubble after interaction.",
  },
  {
    date: "Jan 23, 2026",
    title: "Added a weekly summary and collapsible calendar settings.",
  },
];

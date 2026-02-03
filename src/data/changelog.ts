export type ChangelogEntry = {
  date: string;
  title: string;
};

export const changelogEntries: ChangelogEntry[] = [
  {
    date: "Feb 03, 2026",
    title: "Added ICS calendar export (download or copy to clipboard) and redesigned the weekly calendar.",
  },
  {
    date: "Jan 30, 2026",
    title: "Updated anime data source - the previous one had some scheduling inaccuracies. If you notice any issues, please let me know!",
  },
];

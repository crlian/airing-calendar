export type ChangelogEntry = {
  date: string;
  title: string;
};

export const changelogEntries: ChangelogEntry[] = [
  {
    date: "Mar 29, 2026",
    title: "Improved reliability — anime data now loads from a backup source automatically if the primary is unavailable.",
  },
  {
    date: "Feb 03, 2026",
    title: "Added ICS calendar export (download or copy to clipboard) and redesigned the weekly calendar.",
  },
];

export type ChangelogEntry = {
  date: string;
  title: string;
};

export const changelogEntries: ChangelogEntry[] = [
  {
    date: "Jan 30, 2026",
    title: "Updated anime data source - the previous one had some scheduling inaccuracies. If you notice any issues, please let me know!",
  },
  {
    date: "Jan 28, 2026",
    title: "Got a message asking for total watch time, thought it was a great idea so I added it.",
  },
];

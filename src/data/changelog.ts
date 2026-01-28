export type ChangelogEntry = {
  date: string;
  title: string;
};

export const changelogEntries: ChangelogEntry[] = [
  {
    date: "Jan 28, 2026",
    title: "Got a message asking for total watch time, thought it was a great idea so I added it.",
  },
  {
    date: "Jan 26, 2026",
    title: "Added a lightweight feedback bubble after interaction.",
  },
];

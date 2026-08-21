# Life Tracker

A personal life-tracking app for managing to-dos by category, keeping tabs on
people and when you last spoke with them, and logging knowledge (books,
articles, papers) with a graph view of how entries connect. Built with
Next.js (App Router), TypeScript, Tailwind, and SQLite via Drizzle ORM.

## Running the app

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Data

The SQLite database lives at `data/life.db`. It is created, migrated, and
seeded with default to-do categories automatically the first time the app
runs — no setup step required.

To back up your data, copy the `data/` folder.
# life-tracker

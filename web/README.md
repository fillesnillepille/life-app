# Web app

The Vite, React, and TypeScript front end. See the [root README](../README.md) for how to run it, and [docs/architecture.md](../docs/architecture.md) for how each section works.

## Layout

- `src/App.tsx`: routes. Sections without a page show `PlaceholderPage`.
- `src/pages/`: one file per page, such as `money-page.tsx` (Ekonomi) and `money-month-page.tsx` (entering a month).
- `src/components/`: shared pieces. `panel.tsx` is the boxed section used across pages, and `load-status.tsx` has the loading and error rows.
- `src/components/ui/`: shadcn components. Add them with `npx shadcn@latest add <name>` and avoid editing them by hand.
- `src/lib/`: data and helpers. Each PocketBase collection has a `use-*.ts` hook (`use-todos.ts`, `use-mails.ts`, `use-finance.ts`). `sections.ts` lists the sections and the bottom bar, and `pocketbase.ts` sets up the client.

## Commands

- `npm run dev`: start the dev server
- `npm run build`: type-check and build
- `npm run lint`: lint with oxlint

All text the user sees is Swedish, and dates and numbers use the `sv-SE` locale.

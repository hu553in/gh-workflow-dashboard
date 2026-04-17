# GitHub Workflow Dashboard

[![Vercel Deploy](https://deploy-badge.vercel.app/vercel/gh-workflow-dashboard)](https://gh-workflow-dashboard.vercel.app/)

A client-side dashboard for monitoring GitHub Actions workflows across all of your repositories.

## Features

- Fetches all of a user's repositories and workflows through the GitHub REST API
- Displays the latest run for each workflow, grouped by repository
- Resolves run refs to active branches or tags by comparing SHAs
- Shows each run's status, event type, branch, timestamp, and a link to GitHub
- Supports a collapsible repository/workflow tree
- Provides summary statistics, including total repositories, workflows, and pass/fail counts
- Stores the token in `localStorage` and never sends it anywhere except the GitHub API

## Usage

Open the [deployed app](https://gh-workflow-dashboard.vercel.app/), enter a GitHub personal access token,
and click **Load**.

Required token scopes:

- [Fine-grained PAT](https://github.com/settings/personal-access-tokens):
  `Metadata: read`, `Actions: read`, `Contents: read`
- [Classic PAT](https://github.com/settings/tokens): `repo`

To run the app locally:

```bash
pnpm i
pnpm dev
```

## Development

```bash
pnpm check      # ESLint + Stylelint
pnpm check:fix  # Automatically fixes lint issues
pnpm build      # Production build (Vite → dist/)
```

## Tech stack

- Vanilla JavaScript
- Vite
- GitHub REST API `v2022-11-28`

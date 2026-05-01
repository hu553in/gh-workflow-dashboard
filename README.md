# GitHub workflow dashboard

[![Vercel Deploy](https://deploy-badge.vercel.app/vercel/gh-workflow-dashboard)](https://gh-workflow-dashboard.vercel.app/)

A client-side dashboard for monitoring GitHub Actions workflows across repositories.
It runs entirely in the browser.

## Features

- Fetches all repositories and workflows available to the authenticated user through the GitHub REST API
- Displays the latest run for each workflow, grouped by repository
- Resolves run refs to active branches or tags by comparing SHAs
- Shows each run's status, event type, branch, timestamp, and a link to GitHub
- Supports a collapsible tree grouped by repository and workflow
- Provides summary statistics, including total repositories, workflows, and successful and failed workflow counts
- Stores the token in browser `localStorage` and sends it only to the GitHub API

## Usage

Open the [deployed app](https://gh-workflow-dashboard.vercel.app/), enter a GitHub personal access token,
and click **Load**.

Required token scopes:

- [Fine-grained PAT](https://github.com/settings/personal-access-tokens):
  `Metadata: read`, `Actions: read`, `Contents: read`
- [Classic PAT](https://github.com/settings/tokens): `repo`
  (broad access; prefer a fine-grained PAT when possible)

To run the app locally:

```bash
pnpm i
pnpm dev
```

## Development

```bash
pnpm check      # ESLint + Stylelint
pnpm check:fix  # Automatically fixes lint issues
pnpm build      # Production build (Vite -> dist/)
```

## Tech stack

- Vanilla JavaScript
- Vite
- GitHub REST API `v2022-11-28`

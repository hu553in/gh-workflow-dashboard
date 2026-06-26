# GitHub workflow dashboard

[![CI](https://github.com/hu553in/gh-workflow-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/hu553in/gh-workflow-dashboard/actions/workflows/ci.yml)
[![Vercel Deploy](https://deploy-badge.vercel.app/vercel/gh-workflow-dashboard)](https://gh-workflow-dashboard.vercel.app/)

A client-side dashboard for monitoring GitHub Actions workflows across repositories. It runs
entirely in the browser.

## What it does

- Fetches all repositories and workflows available to the authenticated user through the GitHub REST
  API
- Displays the latest run for each workflow, grouped by repository
- Resolves run refs to active branches or tags by comparing SHAs
- Shows each run's status, event type, branch, timestamp, and a link to GitHub
- Supports a collapsible tree grouped by repository and workflow
- Provides summary statistics, including total repositories, workflows, and workflow counts by run
  state
- Supports optional auto-reload intervals with ETag-based conditional GitHub API requests
- Stores the token in browser `localStorage` and sends it only to the GitHub API

## Requirements

- Node.js and pnpm for local development
- A GitHub personal access token for the repositories you want to inspect

Required token scopes:

- [Fine-grained PAT](https://github.com/settings/personal-access-tokens): `Metadata: read`,
  `Actions: read`, `Contents: read`
- [Classic PAT](https://github.com/settings/tokens): `repo`; prefer a fine-grained PAT when possible

## Setup

```bash
pnpm i
pnpm dev
```

Open <http://localhost:5173>.

## Usage

Open the [deployed app](https://gh-workflow-dashboard.vercel.app/), enter a GitHub personal access
token, and click **Load**.

The token stays in `localStorage` and is used only for requests to `https://api.github.com`.

## Development

```bash
pnpm test       # Tests
pnpm check      # Tests + ESLint + Stylelint
pnpm check:fix  # Automatically fixes lint issues
pnpm build      # Production build (Vite -> dist/)
```

## Runtime behavior

- The app is a static Vite build with no backend service
- GitHub API requests use version `2022-11-28`
- Cached ETags are stored in memory and reset when the token changes
- The production build is written to `dist/`

## Tech stack

- Vanilla JavaScript
- Vite
- GitHub REST API `v2022-11-28`

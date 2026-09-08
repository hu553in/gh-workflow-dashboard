export interface Repository {
  full_name: string;
  html_url: string;
  private: boolean;
  fork: boolean;
  owner: { login: string; avatar_url: string };
}

export interface Workflow {
  id: number;
  name: string;
  path: string;
  state: string;
  html_url: string;
}

export interface WorkflowRun {
  workflow_id: number;
  created_at: string;
  status: string;
  conclusion: string | null;
  event: string;
  head_branch: string;
  head_sha: string;
  html_url: string;
  head_repository: { full_name: string } | null;
}

export interface GitRef {
  name: string;
  commit?: { sha: string };
}

export interface RepoResult {
  repo: Repository;
  workflows: Workflow[];
  latestRuns: Record<string, WorkflowRun>;
}

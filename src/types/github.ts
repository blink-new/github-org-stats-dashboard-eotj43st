export interface GitHubConfig {
  token: string;
  organization: string;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  language: string | null;
  languages_url: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export interface User {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  name: string | null;
  email: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

export interface Commit {
  sha: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  message: string;
  url: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  user: User;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  html_url: string;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface CodeStats {
  repository: string;
  branch: string;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  fileCount: number;
  languageBreakdown: Record<string, {
    lines: number;
    files: number;
    percentage: number;
  }>;
}

export interface UserStats {
  user: User;
  commits: number;
  pullRequests: number;
  linesAdded: number;
  linesDeleted: number;
  repositories: string[];
  languages: Record<string, number>;
  lastActivity: string;
}

export interface OrganizationStats {
  organization: string;
  totalRepositories: number;
  totalMembers: number;
  totalCommits: number;
  totalPullRequests: number;
  totalLinesOfCode: number;
  topLanguages: Record<string, number>;
  repositories: Repository[];
  members: User[];
  userStats: UserStats[];
  codeStats: CodeStats[];
  recentActivity: {
    commits: Commit[];
    pullRequests: PullRequest[];
  };
}

export interface AnalysisProgress {
  stage: 'fetching' | 'cloning' | 'analyzing' | 'complete' | 'error';
  message: string;
  progress: number;
  repository?: string;
}
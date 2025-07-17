import { Octokit } from '@octokit/rest';
import { Repository, User, Commit, PullRequest, GitHubConfig } from '../types/github';

export class GitHubApiService {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
    });
  }

  async getOrganization() {
    try {
      const { data } = await this.octokit.rest.orgs.get({
        org: this.config.organization,
      });
      return data;
    } catch (error) {
      console.error('Error fetching organization:', error);
      throw error;
    }
  }

  async getRepositories(): Promise<Repository[]> {
    try {
      const repositories: Repository[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const { data } = await this.octokit.rest.repos.listForOrg({
          org: this.config.organization,
          per_page: 100,
          page,
          sort: 'updated',
          direction: 'desc',
        });

        repositories.push(...data);
        hasMore = data.length === 100;
        page++;
      }

      return repositories;
    } catch (error) {
      console.error('Error fetching repositories:', error);
      throw error;
    }
  }

  async getOrganizationMembers(): Promise<User[]> {
    try {
      const members: User[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const { data } = await this.octokit.rest.orgs.listMembers({
          org: this.config.organization,
          per_page: 100,
          page,
        });

        // Get detailed user info for each member
        const detailedMembers = await Promise.all(
          data.map(async (member) => {
            try {
              const { data: userDetails } = await this.octokit.rest.users.getByUsername({
                username: member.login,
              });
              return userDetails;
            } catch (error) {
              console.error(`Error fetching user details for ${member.login}:`, error);
              return member;
            }
          })
        );

        members.push(...detailedMembers);
        hasMore = data.length === 100;
        page++;
      }

      return members;
    } catch (error) {
      console.error('Error fetching organization members:', error);
      throw error;
    }
  }

  async getRepositoryCommits(repo: string, branch: string = 'main'): Promise<Commit[]> {
    try {
      const commits: Commit[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 10) { // Limit to 10 pages to avoid rate limits
        const { data } = await this.octokit.rest.repos.listCommits({
          owner: this.config.organization,
          repo,
          sha: branch,
          per_page: 100,
          page,
        });

        commits.push(...data.map(commit => ({
          sha: commit.sha,
          author: {
            name: commit.commit.author?.name || 'Unknown',
            email: commit.commit.author?.email || '',
            date: commit.commit.author?.date || '',
          },
          committer: {
            name: commit.commit.committer?.name || 'Unknown',
            email: commit.commit.committer?.email || '',
            date: commit.commit.committer?.date || '',
          },
          message: commit.commit.message,
          url: commit.html_url,
        })));

        hasMore = data.length === 100;
        page++;
      }

      return commits;
    } catch (error) {
      console.error(`Error fetching commits for ${repo}:`, error);
      return [];
    }
  }

  async getRepositoryPullRequests(repo: string): Promise<PullRequest[]> {
    try {
      const pullRequests: PullRequest[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 5) { // Limit to 5 pages
        const { data } = await this.octokit.rest.pulls.list({
          owner: this.config.organization,
          repo,
          state: 'all',
          per_page: 100,
          page,
          sort: 'updated',
          direction: 'desc',
        });

        pullRequests.push(...data.map(pr => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.merged_at ? 'merged' : pr.state as 'open' | 'closed' | 'merged',
          user: pr.user!,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          closed_at: pr.closed_at,
          merged_at: pr.merged_at,
          html_url: pr.html_url,
          additions: pr.additions || 0,
          deletions: pr.deletions || 0,
          changed_files: pr.changed_files || 0,
        })));

        hasMore = data.length === 100;
        page++;
      }

      return pullRequests;
    } catch (error) {
      console.error(`Error fetching pull requests for ${repo}:`, error);
      return [];
    }
  }

  async getRepositoryLanguages(repo: string): Promise<Record<string, number>> {
    try {
      const { data } = await this.octokit.rest.repos.listLanguages({
        owner: this.config.organization,
        repo,
      });
      return data;
    } catch (error) {
      console.error(`Error fetching languages for ${repo}:`, error);
      return {};
    }
  }

  async getBranches(repo: string): Promise<string[]> {
    try {
      const { data } = await this.octokit.rest.repos.listBranches({
        owner: this.config.organization,
        repo,
        per_page: 100,
      });
      return data.map(branch => branch.name);
    } catch (error) {
      console.error(`Error fetching branches for ${repo}:`, error);
      return ['main', 'master']; // Fallback to common branch names
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.octokit.rest.user.getAuthenticated();
      return true;
    } catch (error) {
      console.error('Invalid GitHub token:', error);
      return false;
    }
  }

  async getRateLimit() {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();
      return data;
    } catch (error) {
      console.error('Error fetching rate limit:', error);
      return null;
    }
  }
}
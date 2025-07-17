import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

interface GitHubConfig {
  token: string;
  organization: string;
}

interface AnalysisRequest {
  action: 'validate' | 'analyze' | 'rate-limit';
  config: GitHubConfig;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: any;
  allow_forking: boolean;
  is_template: boolean;
  topics: string[];
  visibility: string;
  default_branch: string;
}

interface User {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

interface CodeStats {
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

class GitHubApiService {
  private token: string;
  private organization: string;

  constructor(config: GitHubConfig) {
    this.token = config.token;
    this.organization = config.organization;
  }

  private async makeRequest(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Stats-Dashboard',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.makeRequest('https://api.github.com/user');
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async getOrganization() {
    return await this.makeRequest(`https://api.github.com/orgs/${this.organization}`);
  }

  async getRepositories(): Promise<Repository[]> {
    const repositories: Repository[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await this.makeRequest(
        `https://api.github.com/orgs/${this.organization}/repos?per_page=100&page=${page}&sort=updated&direction=desc`
      );

      repositories.push(...data);
      hasMore = data.length === 100;
      page++;
    }

    return repositories;
  }

  async getOrganizationMembers(): Promise<User[]> {
    const members: User[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await this.makeRequest(
        `https://api.github.com/orgs/${this.organization}/members?per_page=100&page=${page}`
      );

      // Get detailed user info for each member
      const detailedMembers = await Promise.all(
        data.map(async (member: any) => {
          try {
            return await this.makeRequest(`https://api.github.com/users/${member.login}`);
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
  }

  async getRepositoryCommits(repo: string, branch: string = 'main') {
    const commits: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) { // Limit to 10 pages to avoid rate limits
      try {
        const data = await this.makeRequest(
          `https://api.github.com/repos/${this.organization}/${repo}/commits?sha=${branch}&per_page=100&page=${page}`
        );

        commits.push(...data.map((commit: any) => ({
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
      } catch (error) {
        console.error(`Error fetching commits for ${repo}:`, error);
        break;
      }
    }

    return commits;
  }

  async getRepositoryPullRequests(repo: string) {
    const pullRequests: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 5) { // Limit to 5 pages
      try {
        const data = await this.makeRequest(
          `https://api.github.com/repos/${this.organization}/${repo}/pulls?state=all&per_page=100&page=${page}&sort=updated&direction=desc`
        );

        pullRequests.push(...data.map((pr: any) => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.merged_at ? 'merged' : pr.state,
          user: pr.user,
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
      } catch (error) {
        console.error(`Error fetching pull requests for ${repo}:`, error);
        break;
      }
    }

    return pullRequests;
  }

  async getRepositoryLanguages(repo: string): Promise<Record<string, number>> {
    try {
      return await this.makeRequest(`https://api.github.com/repos/${this.organization}/${repo}/languages`);
    } catch (error) {
      console.error(`Error fetching languages for ${repo}:`, error);
      return {};
    }
  }

  async getBranches(repo: string): Promise<string[]> {
    try {
      const data = await this.makeRequest(
        `https://api.github.com/repos/${this.organization}/${repo}/branches?per_page=100`
      );
      return data.map((branch: any) => branch.name);
    } catch (error) {
      console.error(`Error fetching branches for ${repo}:`, error);
      return ['main', 'master']; // Fallback to common branch names
    }
  }

  async getRateLimit() {
    try {
      return await this.makeRequest('https://api.github.com/rate_limit');
    } catch (error) {
      console.error('Error fetching rate limit:', error);
      return null;
    }
  }

  async analyzeRepositoryCode(repo: Repository): Promise<CodeStats> {
    const stats: CodeStats = {
      repository: repo.name,
      branch: repo.default_branch,
      totalLines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      fileCount: 0,
      languageBreakdown: {},
    };

    try {
      // Get repository contents recursively
      const files = await this.getRepositoryFiles(repo);
      stats.fileCount = files.length;

      // Analyze each file
      for (const file of files) {
        try {
          const fileStats = await this.analyzeFileContent(file);
          const language = this.getLanguageFromFile(file.path);
          
          stats.totalLines += fileStats.totalLines;
          stats.codeLines += fileStats.codeLines;
          stats.commentLines += fileStats.commentLines;
          stats.blankLines += fileStats.blankLines;

          if (!stats.languageBreakdown[language]) {
            stats.languageBreakdown[language] = {
              lines: 0,
              files: 0,
              percentage: 0,
            };
          }

          stats.languageBreakdown[language].lines += fileStats.totalLines;
          stats.languageBreakdown[language].files += 1;
        } catch (error) {
          console.warn(`Could not analyze file ${file.path}:`, error);
        }
      }

      // Calculate percentages
      Object.keys(stats.languageBreakdown).forEach(language => {
        if (stats.totalLines > 0) {
          stats.languageBreakdown[language].percentage = 
            (stats.languageBreakdown[language].lines / stats.totalLines) * 100;
        }
      });

    } catch (error) {
      console.error(`Error analyzing repository ${repo.name}:`, error);
    }

    return stats;
  }

  private async getRepositoryFiles(repo: Repository): Promise<any[]> {
    const includeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs',
      '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.clj', '.hs',
      '.ml', '.r', '.m', '.pl', '.sh', '.sql', '.html', '.css', '.scss',
      '.less', '.vue', '.svelte', '.dart', '.lua', '.nim', '.zig'
    ];

    try {
      // Get repository tree
      const data = await this.makeRequest(
        `https://api.github.com/repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`
      );
      
      // Filter for code files only
      const codeFiles = data.tree.filter((item: any) => {
        if (item.type !== 'blob') return false;
        
        const ext = '.' + item.path.split('.').pop()?.toLowerCase();
        return includeExtensions.includes(ext);
      });

      // Limit to first 100 files to avoid rate limits and long analysis times
      return codeFiles.slice(0, 100);

    } catch (error) {
      console.error('Error fetching repository files:', error);
      return [];
    }
  }

  private async analyzeFileContent(file: any): Promise<{
    totalLines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
  }> {
    try {
      // For large files, skip analysis to avoid rate limits
      if (file.size > 100000) { // Skip files larger than 100KB
        return { totalLines: 0, codeLines: 0, commentLines: 0, blankLines: 0 };
      }

      const data = await this.makeRequest(file.url);
      
      if (data.encoding === 'base64') {
        const content = atob(data.content.replace(/\n/g, ''));
        return this.analyzeTextContent(content, file.path);
      }
      
      return { totalLines: 0, codeLines: 0, commentLines: 0, blankLines: 0 };

    } catch (error) {
      console.warn(`Could not analyze file ${file.path}:`, error);
      return { totalLines: 0, codeLines: 0, commentLines: 0, blankLines: 0 };
    }
  }

  private analyzeTextContent(content: string, filePath: string): {
    totalLines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
  } {
    const lines = content.split('\n');
    
    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;
    
    const language = this.getLanguageFromFile(filePath);
    const commentPatterns = this.getCommentPatterns(language);
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        blankLines++;
      } else if (this.isCommentLine(trimmedLine, commentPatterns)) {
        commentLines++;
      } else {
        codeLines++;
      }
    }
    
    return {
      totalLines: lines.length,
      codeLines,
      commentLines,
      blankLines,
    };
  }

  private getLanguageFromFile(filePath: string): string {
    const ext = '.' + filePath.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.h': 'C/C++',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.vue': 'Vue',
      '.svelte': 'Svelte',
    };
    
    return languageMap[ext] || 'Other';
  }

  private getCommentPatterns(language: string): { single: string[]; multi: { start: string; end: string }[] } {
    const patterns: Record<string, { single: string[]; multi: { start: string; end: string }[] }> = {
      'JavaScript': { single: ['//'], multi: [{ start: '/*', end: '*/' }] },
      'TypeScript': { single: ['//'], multi: [{ start: '/*', end: '*/' }] },
      'Python': { single: ['#'], multi: [{ start: '"""', end: '"""' }, { start: "'''", end: "'''" }] },
      'Java': { single: ['//'], multi: [{ start: '/*', end: '*/' }] },
      'C++': { single: ['//'], multi: [{ start: '/*', end: '*/' }] },
      'C': { single: ['//'], multi: [{ start: '/*', end: '*/' }] },
      'C#': { single: ['//'], multi: [{ start: '/*', end: '*/' }] },
      'PHP': { single: ['//', '#'], multi: [{ start: '/*', end: '*/' }] },
      'Ruby': { single: ['#'], multi: [{ start: '=begin', end: '=end' }] },
      'Go': { single: ['//'], multi: [{ start: '/*', end: '*/' }] },
      'Rust': { single: ['//'], multi: [{ start: '/*', end: '*/' }] },
      'HTML': { single: [], multi: [{ start: '<!--', end: '-->' }] },
      'CSS': { single: [], multi: [{ start: '/*', end: '*/' }] },
    };
    
    return patterns[language] || { single: [], multi: [] };
  }

  private isCommentLine(line: string, patterns: { single: string[]; multi: { start: string; end: string }[] }): boolean {
    // Check single-line comments
    for (const pattern of patterns.single) {
      if (line.startsWith(pattern)) {
        return true;
      }
    }
    
    // Check multi-line comments (simplified - just check if line starts with comment start)
    for (const pattern of patterns.multi) {
      if (line.startsWith(pattern.start)) {
        return true;
      }
    }
    
    return false;
  }

  async performFullAnalysis() {
    // Fetch basic organization data
    const org = await this.getOrganization();
    const repositories = await this.getRepositories();
    const members = await this.getOrganizationMembers();

    // Analyze repositories with code analysis
    const codeStats: CodeStats[] = [];
    const recentCommits: any[] = [];
    const recentPullRequests: any[] = [];

    for (const repo of repositories) {
      try {
        // Perform code analysis
        const repoCodeStats = await this.analyzeRepositoryCode(repo);
        codeStats.push(repoCodeStats);

        // Fetch commits and PRs via API
        const commits = await this.getRepositoryCommits(repo.name);
        const pullRequests = await this.getRepositoryPullRequests(repo.name);

        recentCommits.push(...commits.slice(0, 10)); // Latest 10 commits per repo
        recentPullRequests.push(...pullRequests.slice(0, 5)); // Latest 5 PRs per repo

      } catch (error) {
        console.error(`Error analyzing repository ${repo.name}:`, error);
        // Continue with other repositories even if one fails
      }
    }

    // Compute user statistics
    const userStats = this.computeUserStats(members, repositories, recentCommits, recentPullRequests);

    // Compute organization statistics
    const organizationStats = this.computeOrganizationStats(
      org,
      repositories,
      members,
      userStats,
      codeStats,
      recentCommits,
      recentPullRequests
    );

    return organizationStats;
  }

  private computeUserStats(
    members: User[],
    repositories: Repository[],
    commits: any[],
    pullRequests: any[]
  ) {
    const userStatsMap = new Map<string, any>();

    // Initialize user stats
    members.forEach(member => {
      userStatsMap.set(member.login, {
        user: member,
        commits: 0,
        pullRequests: 0,
        linesAdded: 0,
        linesDeleted: 0,
        repositories: [],
        languages: {},
        lastActivity: '',
      });
    });

    // Process commits
    commits.forEach(commit => {
      const authorLogin = this.findUserByEmail(members, commit.author.email)?.login;
      if (authorLogin && userStatsMap.has(authorLogin)) {
        const userStats = userStatsMap.get(authorLogin)!;
        userStats.commits++;
        
        const commitDate = new Date(commit.author.date);
        const lastActivity = new Date(userStats.lastActivity || 0);
        if (commitDate > lastActivity) {
          userStats.lastActivity = commit.author.date;
        }
      }
    });

    // Process pull requests
    pullRequests.forEach(pr => {
      const userLogin = pr.user.login;
      if (userStatsMap.has(userLogin)) {
        const userStats = userStatsMap.get(userLogin)!;
        userStats.pullRequests++;
        userStats.linesAdded += pr.additions;
        userStats.linesDeleted += pr.deletions;

        const prDate = new Date(pr.created_at);
        const lastActivity = new Date(userStats.lastActivity || 0);
        if (prDate > lastActivity) {
          userStats.lastActivity = pr.created_at;
        }
      }
    });

    return Array.from(userStatsMap.values());
  }

  private findUserByEmail(members: User[], email: string): User | undefined {
    return members.find(member => member.email === email);
  }

  private computeOrganizationStats(
    org: any,
    repositories: Repository[],
    members: User[],
    userStats: any[],
    codeStats: CodeStats[],
    recentCommits: any[],
    recentPullRequests: any[]
  ) {
    // Compute total lines of code across all repositories
    const totalLinesOfCode = codeStats.reduce((total, stats) => total + stats.totalLines, 0);

    // Compute top languages
    const languageMap = new Map<string, number>();
    codeStats.forEach(stats => {
      Object.entries(stats.languageBreakdown).forEach(([language, data]) => {
        languageMap.set(language, (languageMap.get(language) || 0) + data.lines);
      });
    });

    const topLanguages = Object.fromEntries(
      Array.from(languageMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    );

    // Sort recent activity by date
    const sortedCommits = recentCommits
      .sort((a, b) => new Date(b.author.date).getTime() - new Date(a.author.date).getTime())
      .slice(0, 50);

    const sortedPullRequests = recentPullRequests
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    return {
      organization: org.login,
      totalRepositories: repositories.length,
      totalMembers: members.length,
      totalCommits: userStats.reduce((total, user) => total + user.commits, 0),
      totalPullRequests: userStats.reduce((total, user) => total + user.pullRequests, 0),
      totalLinesOfCode,
      topLanguages,
      repositories,
      members,
      userStats,
      codeStats,
      recentActivity: {
        commits: sortedCommits,
        pullRequests: sortedPullRequests,
      },
    };
  }
}

serve(async (req) => {
  // Handle CORS for frontend calls
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const body: AnalysisRequest = await req.json();
    const { action, config } = body;

    if (!config || !config.token || !config.organization) {
      return new Response(JSON.stringify({ error: 'Missing required configuration' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const githubApi = new GitHubApiService(config);

    let result;
    switch (action) {
      case 'validate': {
        const isValid = await githubApi.validateToken();
        if (isValid) {
          // Also check if we can access the organization
          await githubApi.getOrganization();
        }
        result = { valid: isValid };
        break;
      }

      case 'analyze': {
        result = await githubApi.performFullAnalysis();
        break;
      }

      case 'rate-limit': {
        result = await githubApi.getRateLimit();
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in GitHub analysis function:', error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
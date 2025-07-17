import { CodeStats, Repository, AnalysisProgress } from '../types/github';

export class GitAnalyzer {
  private progressCallback?: (progress: AnalysisProgress) => void;

  setProgressCallback(callback: (progress: AnalysisProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: AnalysisProgress['stage'], message: string, progress: number, repository?: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, message, progress, repository });
    }
  }

  async analyzeRepository(repo: Repository, token: string): Promise<CodeStats> {
    try {
      this.updateProgress('analyzing', `Analyzing ${repo.name} via GitHub API...`, 0, repo.name);
      
      // Since we can't clone repositories in the browser, we'll use GitHub API
      // to get file contents and analyze them
      const stats = await this.analyzeRepositoryViaAPI(repo, token);
      
      this.updateProgress('complete', `Analysis complete for ${repo.name}`, 100, repo.name);
      return stats;
      
    } catch (error) {
      this.updateProgress('error', `Error analyzing ${repo.name}: ${error}`, 0, repo.name);
      console.error(`Error analyzing repository ${repo.name}:`, error);
      
      // Return empty stats on error
      return {
        repository: repo.name,
        branch: 'main',
        totalLines: 0,
        codeLines: 0,
        commentLines: 0,
        blankLines: 0,
        fileCount: 0,
        languageBreakdown: {},
      };
    }
  }

  private async analyzeRepositoryViaAPI(repo: Repository, token: string): Promise<CodeStats> {
    const stats: CodeStats = {
      repository: repo.name,
      branch: 'main',
      totalLines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      fileCount: 0,
      languageBreakdown: {},
    };

    try {
      // Get repository contents recursively
      const files = await this.getRepositoryFiles(repo, token);
      stats.fileCount = files.length;

      // Analyze each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = (i / files.length) * 80; // 80% for file analysis
        
        this.updateProgress('analyzing', `Analyzing file ${file.name}...`, progress, repo.name);
        
        try {
          const fileStats = await this.analyzeFileContent(file, token);
          const language = this.getLanguageFromFile(file.name);
          
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
          console.warn(`Could not analyze file ${file.name}:`, error);
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
      console.error(`Error analyzing repository ${repo.name} via API:`, error);
    }

    return stats;
  }

  private async getRepositoryFiles(repo: Repository, token: string): Promise<any[]> {
    const files: any[] = [];
    const includeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs',
      '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.clj', '.hs',
      '.ml', '.r', '.m', '.pl', '.sh', '.sql', '.html', '.css', '.scss',
      '.less', '.vue', '.svelte', '.dart', '.lua', '.nim', '.zig'
    ];

    try {
      // Get repository tree
      const response = await fetch(
        `https://api.github.com/repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch repository tree: ${response.statusText}`);
      }

      const data = await response.json();
      
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

  private async analyzeFileContent(file: any, token: string): Promise<{
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

      const response = await fetch(file.url, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`);
      }

      const data = await response.json();
      
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
}
import { GitHubConfig, OrganizationStats } from '../types/github';

const BACKEND_URL = 'https://eotj43st--github-analysis.functions.blink.new';

export class BackendApiService {
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  private async makeRequest(action: string, data?: any) {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        config: this.config,
        ...data,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      const result = await this.makeRequest('validate');
      return result.valid;
    } catch (error) {
      console.error('Configuration validation failed:', error);
      return false;
    }
  }

  async performFullAnalysis(): Promise<OrganizationStats> {
    return await this.makeRequest('analyze');
  }

  async getRateLimit() {
    return await this.makeRequest('rate-limit');
  }
}
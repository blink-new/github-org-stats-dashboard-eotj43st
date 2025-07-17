import { BackendApiService } from './backendApi';
import { 
  GitHubConfig, 
  OrganizationStats, 
  AnalysisProgress
} from '../types/github';

export class AnalysisService {
  private backendApi: BackendApiService;
  private progressCallback?: (progress: AnalysisProgress) => void;

  constructor(config: GitHubConfig) {
    this.backendApi = new BackendApiService(config);
  }

  setProgressCallback(callback: (progress: AnalysisProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: AnalysisProgress['stage'], message: string, progress: number) {
    if (this.progressCallback) {
      this.progressCallback({ stage, message, progress });
    }
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      this.updateProgress('fetching', 'Validating GitHub token...', 0);
      const isValid = await this.backendApi.validateConfiguration();
      
      if (!isValid) {
        this.updateProgress('error', 'Invalid GitHub token or organization access', 0);
        return false;
      }

      this.updateProgress('complete', 'Configuration validated successfully', 100);
      return true;
    } catch (error) {
      this.updateProgress('error', `Configuration validation failed: ${error}`, 0);
      return false;
    }
  }

  async performFullAnalysis(): Promise<OrganizationStats> {
    try {
      this.updateProgress('fetching', 'Starting organization analysis...', 0);
      this.updateProgress('fetching', 'Fetching organization data...', 10);
      this.updateProgress('fetching', 'Fetching repositories...', 25);
      this.updateProgress('analyzing', 'Analyzing code statistics...', 40);
      this.updateProgress('analyzing', 'Processing commits and pull requests...', 60);
      this.updateProgress('analyzing', 'Computing user statistics...', 80);
      this.updateProgress('analyzing', 'Finalizing analysis...', 95);

      const organizationStats = await this.backendApi.performFullAnalysis();

      this.updateProgress('complete', 'Analysis complete!', 100);
      return organizationStats;

    } catch (error) {
      this.updateProgress('error', `Analysis failed: ${error}`, 0);
      throw error;
    }
  }

  async getRateLimit() {
    return await this.backendApi.getRateLimit();
  }
}
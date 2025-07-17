import React, { useState, useCallback } from 'react';
import { ConfigurationForm } from './components/ConfigurationForm';
import { AnalysisProgress } from './components/AnalysisProgress';
import { Dashboard } from './components/Dashboard';
import { AnalysisService } from './services/analysisService';
import { 
  GitHubConfig, 
  OrganizationStats, 
  AnalysisProgress as AnalysisProgressType 
} from './types/github';

type AppState = 'configuration' | 'validating' | 'analyzing' | 'dashboard' | 'error';

function App() {
  const [state, setState] = useState<AppState>('configuration');
  const [config, setConfig] = useState<GitHubConfig | null>(null);
  const [analysisService, setAnalysisService] = useState<AnalysisService | null>(null);
  const [progress, setProgress] = useState<AnalysisProgressType>({
    stage: 'fetching',
    message: 'Starting analysis...',
    progress: 0,
  });
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [error, setError] = useState<string>('');

  const handleConfigSubmit = useCallback(async (newConfig: GitHubConfig) => {
    setState('validating');
    setConfig(newConfig);
    setError('');

    try {
      const service = new AnalysisService(newConfig);
      setAnalysisService(service);

      // Set up progress callback
      service.setProgressCallback((progressUpdate) => {
        setProgress(progressUpdate);
      });

      // Validate configuration
      const isValid = await service.validateConfiguration();
      
      if (!isValid) {
        setError('Invalid configuration. Please check your token and organization name.');
        setState('configuration');
        return;
      }

      // Start analysis
      setState('analyzing');
      const organizationStats = await service.performFullAnalysis();
      
      setStats(organizationStats);
      setState('dashboard');

    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setState('configuration');
    }
  }, []);

  const handleReset = useCallback(() => {
    setState('configuration');
    setConfig(null);
    setAnalysisService(null);
    setStats(null);
    setError('');
    setProgress({
      stage: 'fetching',
      message: 'Starting analysis...',
      progress: 0,
    });
  }, []);

  const renderCurrentState = () => {
    switch (state) {
      case 'configuration':
        return (
          <ConfigurationForm
            onConfigSubmit={handleConfigSubmit}
            isValidating={state === 'validating'}
            validationError={error}
          />
        );
      
      case 'validating':
      case 'analyzing':
        return <AnalysisProgress progress={progress} />;
      
      case 'dashboard':
        return stats ? (
          <Dashboard stats={stats} onReset={handleReset} />
        ) : (
          <div className="min-h-screen flex items-center justify-center">
            <p>Loading dashboard...</p>
          </div>
        );
      
      case 'error':
        return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Analysis Failed</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Try Again
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen">
      {renderCurrentState()}
    </div>
  );
}

export default App;
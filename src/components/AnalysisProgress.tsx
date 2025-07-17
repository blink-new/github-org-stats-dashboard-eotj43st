import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { AnalysisProgress as AnalysisProgressType } from '../types/github';
import { 
  Download, 
  GitBranch, 
  Search, 
  CheckCircle, 
  AlertCircle,
  Github
} from 'lucide-react';

interface AnalysisProgressProps {
  progress: AnalysisProgressType;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ progress }) => {
  const getStageIcon = (stage: AnalysisProgressType['stage']) => {
    switch (stage) {
      case 'fetching':
        return <Download className="w-5 h-5 text-blue-500" />;
      case 'cloning':
        return <GitBranch className="w-5 h-5 text-orange-500" />;
      case 'analyzing':
        return <Search className="w-5 h-5 text-purple-500" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Github className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStageColor = (stage: AnalysisProgressType['stage']) => {
    switch (stage) {
      case 'fetching':
        return 'text-blue-600';
      case 'cloning':
        return 'text-orange-600';
      case 'analyzing':
        return 'text-purple-600';
      case 'complete':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getProgressColor = (stage: AnalysisProgressType['stage']) => {
    switch (stage) {
      case 'fetching':
        return 'bg-blue-500';
      case 'cloning':
        return 'bg-orange-500';
      case 'analyzing':
        return 'bg-purple-500';
      case 'complete':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            {getStageIcon(progress.stage)}
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold text-gray-900">
              Analyzing Organization
            </CardTitle>
            <p className="text-gray-600 mt-2">
              This may take a few minutes depending on repository size
            </p>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStageIcon(progress.stage)}
                <span className={`font-medium ${getStageColor(progress.stage)}`}>
                  {progress.stage.charAt(0).toUpperCase() + progress.stage.slice(1)}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {Math.round(progress.progress)}%
              </span>
            </div>
            
            <Progress 
              value={progress.progress} 
              className="h-2"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-700 font-medium">
              {progress.message}
            </p>
            {progress.repository && (
              <p className="text-xs text-gray-500">
                Repository: {progress.repository}
              </p>
            )}
          </div>

          {progress.stage === 'error' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                Analysis failed. Please check your configuration and try again.
              </p>
            </div>
          )}

          {progress.stage === 'complete' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                Analysis completed successfully! Loading dashboard...
              </p>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 pt-4">
            {['fetching', 'cloning', 'analyzing', 'complete'].map((stage, index) => (
              <div
                key={stage}
                className={`h-1 rounded-full transition-all duration-300 ${
                  ['fetching', 'cloning', 'analyzing', 'complete'].indexOf(progress.stage) >= index
                    ? getProgressColor(progress.stage)
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
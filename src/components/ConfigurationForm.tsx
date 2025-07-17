import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { GitHubConfig } from '../types/github';
import { Github, Key, Building2 } from 'lucide-react';

interface ConfigurationFormProps {
  onConfigSubmit: (config: GitHubConfig) => void;
  isValidating: boolean;
  validationError?: string;
}

export const ConfigurationForm: React.FC<ConfigurationFormProps> = ({
  onConfigSubmit,
  isValidating,
  validationError,
}) => {
  const [token, setToken] = useState('');
  const [organization, setOrganization] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim() && organization.trim()) {
      onConfigSubmit({
        token: token.trim(),
        organization: organization.trim(),
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <Github className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold text-gray-900">
              GitHub Organization Stats
            </CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              Configure your GitHub access to analyze organization statistics
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="token" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Key className="w-4 h-4" />
                GitHub Personal Access Token
              </Label>
              <Input
                id="token"
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                required
              />
              <p className="text-xs text-gray-500">
                Token needs 'repo' and 'read:org' permissions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Organization Name
              </Label>
              <Input
                id="organization"
                type="text"
                placeholder="your-organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                required
              />
              <p className="text-xs text-gray-500">
                The GitHub organization to analyze
              </p>
            </div>

            {validationError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">
                  {validationError}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2.5 transition-all duration-200 transform hover:scale-[1.02]"
              disabled={isValidating || !token.trim() || !organization.trim()}
            >
              {isValidating ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Validating...
                </div>
              ) : (
                'Start Analysis'
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">How to get a GitHub token:</h4>
            <ol className="text-xs text-blue-700 space-y-1">
              <li>1. Go to GitHub Settings → Developer settings</li>
              <li>2. Click "Personal access tokens" → "Tokens (classic)"</li>
              <li>3. Generate new token with 'repo' and 'read:org' scopes</li>
              <li>4. Copy the token and paste it above</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
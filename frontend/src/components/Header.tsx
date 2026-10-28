import React, { useState } from 'react';
import { Sparkles, Key, GitBranch, Play, Sliders, ExternalLink, ShieldCheck, Cpu } from 'lucide-react';
import { AuditSkill } from '../types';
import { ApiSettings } from './ApiSettingsModal';

interface HeaderProps {
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  pat: string;
  setPat: (pat: string) => void;
  onStartAudit: () => void;
  isLoading: boolean;
  activeSkill: AuditSkill | null;
  onOpenSkillModal: () => void;
  apiSettings: ApiSettings;
  onOpenApiModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  repoUrl,
  setRepoUrl,
  pat,
  setPat,
  onStartAudit,
  isLoading,
  activeSkill,
  onOpenSkillModal,
  apiSettings,
  onOpenApiModal,
}) => {
  const [showPatInput, setShowPatInput] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoUrl.trim() && !isLoading) {
      onStartAudit();
    }
  };

  const handleUseDemo = (url: string) => {
    setRepoUrl(url);
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
      <div className="max-w-[1720px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 self-start lg:self-auto">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg text-white tracking-tight">DesignAuditor<span className="text-indigo-400">.ai</span></h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                Side-by-Side
              </span>
            </div>
            <p className="text-xs text-slate-400">Clone · Audit Agent Harness · Pure HTML/CSS Redesign</p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-3xl w-full flex flex-col sm:flex-row items-center gap-2">
          {/* GitHub URL Input */}
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </div>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="Enter GitHub URL (e.g. https://github.com/owner/repo)..."
              disabled={isLoading}
              className="w-full pl-10 pr-24 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-slate-100 placeholder-slate-500 rounded-lg outline-none transition disabled:opacity-50"
            />
            {/* Quick Demo Pill */}
            {!repoUrl && (
              <button
                type="button"
                onClick={() => handleUseDemo('https://github.com/nikhil-b-yorkie/AI-SDLC-hackthon-team10')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 hover:text-indigo-300 bg-slate-800/80 hover:bg-slate-700/80 px-2 py-1 rounded transition"
              >
                Use this repo
              </button>
            )}
          </div>

          {/* PAT Toggle Button */}
          <button
            type="button"
            onClick={() => setShowPatInput(!showPatInput)}
            title="Configure GitHub Personal Access Token for Private Repos"
            className={`px-3 py-2.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition ${
              pat || showPatInput
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/70 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{pat ? 'PAT Active' : 'PAT'}</span>
          </button>

          {/* Run Audit CTA */}
          <button
            type="submit"
            disabled={!repoUrl.trim() || isLoading}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-slate-800 disabled:to-slate-800 text-white font-semibold text-sm rounded-lg shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:shadow-none min-w-[140px]"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Auditing...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run UI/UX Audit</span>
              </>
            )}
          </button>
        </form>

        {/* Right Tools (API Provider, Skill Manager & Info) */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <button
            type="button"
            onClick={onOpenApiModal}
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-2 transition"
            title="Configure AI Provider (Gemini or OpenRouter)"
          >
            {apiSettings.provider === 'openrouter' ? (
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            )}
            <span className="capitalize">{apiSettings.provider}</span>
            <span className={`w-2 h-2 rounded-full ${apiSettings.apiKey ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          </button>

          <button
            type="button"
            onClick={onOpenSkillModal}
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-2 transition"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Audit Skill</span>
            <span className={`w-2 h-2 rounded-full ${activeSkill?.source === 'custom' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          </button>
        </div>
      </div>

      {/* Expandable PAT Input Bar */}
      {showPatInput && (
        <div className="max-w-[1720px] mx-auto mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-amber-400/90 font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Personal Access Token (for private GitHub repositories):</span>
          </div>
          <div className="flex-1 w-full relative">
            <input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="github_pat_... (never logged or saved to disk)"
              className="w-full px-3 py-1.5 bg-slate-950 border border-amber-500/30 focus:border-amber-500 text-xs text-amber-200 placeholder-slate-600 rounded-md outline-none"
            />
          </div>
          <span className="text-[11px] text-slate-400">Token used in-memory for shallow clone and discarded.</span>
        </div>
      )}
    </header>
  );
};

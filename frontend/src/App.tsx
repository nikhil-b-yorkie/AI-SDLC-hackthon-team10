import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  GitBranch, 
  Search, 
  Layout, 
  Award, 
  ArrowRight, 
  MousePointerClick,
  Sliders,
} from 'lucide-react';
import { Header } from './components/Header';
import { ApiSettingsModal, ApiSettings } from './components/ApiSettingsModal';
import { AuditProgressBar } from './components/AuditProgressBar';
import { SplitWorkspace } from './components/SplitWorkspace';
import { ScorecardDrawer } from './components/ScorecardDrawer';
import { SessionStatus, AuditResult } from './types';

export const App: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [pat, setPat] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({
    sessionId: '',
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  // Persistent API Settings (OpenRouter default with best free model)
  const [apiSettings, setApiSettings] = useState<ApiSettings>(() => {
    const saved = localStorage.getItem('designauditor_api_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      provider: 'openrouter',
      apiKey: '',
      model: 'deepseek/deepseek-r1-0528:free',
    };
  });

  const handleSaveApiSettings = (settings: ApiSettings) => {
    setApiSettings(settings);
    localStorage.setItem('designauditor_api_settings', JSON.stringify(settings));
  };

  // Handle SSE progress stream
  useEffect(() => {
    if (!sessionId) return;

    const eventSource = new EventSource(`/api/audit/stream/${sessionId}`);

    eventSource.onmessage = (event) => {
      try {
        const data: SessionStatus = JSON.parse(event.data);
        setSessionStatus(data);

        if (data.status === 'completed' && data.result) {
          setAuditResult(data.result);
          setIsScorecardOpen(true); // Open scorecard drawer upon completion
          eventSource.close();
        } else if (data.status === 'failed') {
          eventSource.close();
        }
      } catch {
        // Ignore parse error
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId]);

  const handleStartAudit = async () => {
    if (!repoUrl.trim()) return;

    setAuditResult(null);
    setSessionStatus({
      sessionId: '',
      status: 'cloning',
      progress: 5,
      message: 'Contacting server and allocating isolated workspace...',
    });

    try {
      const resp = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          repoUrl: repoUrl.trim(), 
          pat: pat.trim() || undefined,
          apiKey: apiSettings.apiKey.trim() || undefined,
          apiProvider: apiSettings.provider,
          model: apiSettings.model.trim() || undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to start audit');
      }

      const { sessionId: newSessionId } = await resp.json();
      setSessionId(newSessionId);
    } catch (err: any) {
      setSessionStatus({
        sessionId: '',
        status: 'failed',
        progress: 100,
        message: 'Failed to start audit pipeline',
        error: err.message,
      });
    }
  };

  const isLoading = sessionStatus.status !== 'idle' && sessionStatus.status !== 'completed' && sessionStatus.status !== 'failed';
  const isCompleted = sessionStatus.status === 'completed' && sessionId !== null;

  return (
    <div className={`bg-slate-950 flex flex-col font-sans text-slate-100 ${isCompleted ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* Top Header */}
      <Header
        repoUrl={repoUrl}
        setRepoUrl={setRepoUrl}
        pat={pat}
        setPat={setPat}
        onStartAudit={handleStartAudit}
        isLoading={isLoading}
        apiSettings={apiSettings}
        onOpenApiModal={() => setIsApiModalOpen(true)}
      />

      {/* Progress Bar (when active or failed) */}
      {(isLoading || sessionStatus.status === 'failed') && (
        <div className="flex-1 flex flex-col justify-center items-center py-12">
          <AuditProgressBar sessionStatus={sessionStatus} />
        </div>
      )}

      {/* Main Comparison Workspace (when completed) */}
      {isCompleted && sessionId && (
        <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
          <SplitWorkspace
            sessionId={sessionId}
            auditResult={auditResult || undefined}
            onOpenScorecard={() => setIsScorecardOpen(!isScorecardOpen)}
            isScorecardOpen={isScorecardOpen}
          />
        </div>
      )}

      {/* Idle Landing State (Initial Hero) */}
      {!isLoading && !isCompleted && sessionStatus.status !== 'failed' && (
        <main className="flex-1 max-w-6xl mx-auto px-6 py-14 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered UI/UX Audit &amp; Redesign Platform</span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-4xl leading-[1.15] mb-6">
            Turn Any GitHub Repository Into a <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400">High-Fidelity Redesign</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
            Clone your frontend repository, evaluate it with a built-in 100-point UI/UX audit skill, and interactively compare the original vs. improved version side-by-side with on-hover UX rationales.
          </p>

          {/* Skill Info Banner */}
          <div className="w-full max-w-3xl mb-8 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex items-start gap-3 text-left">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0 mt-0.5">
              <Sliders className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-300 mb-0.5">Built-in Skill: UI Audit — 100-Point Quality Model</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Audits accessibility, usability, visual hierarchy, consistency, responsiveness, and copy. Produces scored findings, a before/after report, and a modernized HTML/CSS preview with interactive hover annotations on every improvement.
              </p>
            </div>
          </div>

          {/* 4 Feature Steps Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full text-left mb-12">
            {[
              {
                step: 'Step 1',
                title: 'Clone Project',
                desc: 'Supports public & private repos with GitHub Personal Access Tokens (PAT). Shallow clone for instant extraction.',
                icon: GitBranch,
                accent: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5',
              },
              {
                step: 'Step 2',
                title: 'Run Agent Audit',
                desc: '100-point quality model across 6 dimensions. Generates scorecard and granular issue list with AI via OpenRouter.',
                icon: Search,
                accent: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5',
              },
              {
                step: 'Step 3',
                title: 'Pure HTML/CSS',
                desc: 'Synthesizes clean, modernized HTML5/CSS3 preview embedded with audit metadata for hover annotations.',
                icon: Layout,
                accent: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
              },
              {
                step: 'Step 4',
                title: 'Side-by-Side View',
                desc: 'Inspect Before vs After with synchronized scrolling, responsive viewport toggles, and on-hover improvement tooltips.',
                icon: MousePointerClick,
                accent: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.step} className={`p-5 rounded-2xl border ${f.accent} backdrop-blur-sm transition hover:-translate-y-1`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{f.step}</span>
                    <Icon className="w-5 h-5 opacity-90" />
                  </div>
                  <h3 className="font-bold text-sm text-white mb-1.5">{f.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => {
                setRepoUrl('https://github.com/nikhil-b-yorkie/AI-SDLC-hackthon-team10');
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 transition"
            >
              <span>Load Current Hackathon Repo</span>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            </button>

            <button
              onClick={() => setIsApiModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-xs font-semibold text-indigo-300 flex items-center gap-2 transition"
            >
              <Award className="w-3.5 h-3.5 text-indigo-400" />
              <span>Configure OpenRouter API Key</span>
            </button>
          </div>
        </main>
      )}

      {/* AI Provider Settings Modal */}
      <ApiSettingsModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        settings={apiSettings}
        onSaveSettings={handleSaveApiSettings}
      />

      {/* Scorecard Drawer */}
      {auditResult && (
        <ScorecardDrawer
          isOpen={isScorecardOpen}
          onClose={() => setIsScorecardOpen(false)}
          auditResult={auditResult}
        />
      )}
    </div>
  );
};

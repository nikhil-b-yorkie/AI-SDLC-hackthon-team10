import React from 'react';
import { GitBranch, Search, Sparkles, Layout, CheckCircle, AlertCircle } from 'lucide-react';
import { SessionStatus } from '../types';

interface AuditProgressBarProps {
  sessionStatus: SessionStatus;
}

export const AuditProgressBar: React.FC<AuditProgressBarProps> = ({ sessionStatus }) => {
  const steps = [
    { key: 'cloning', label: '1. Clone Repository', icon: GitBranch },
    { key: 'analyzing', label: '2. Project Extraction', icon: Search },
    { key: 'auditing', label: '3. Agent Audit Run', icon: Sparkles },
    { key: 'redesigning', label: '4. Pure HTML/CSS Redesign', icon: Layout },
  ];

  const getStepState = (stepKey: string) => {
    if (sessionStatus.status === 'failed') return 'failed';
    if (sessionStatus.status === 'completed') return 'completed';

    const order = ['cloning', 'analyzing', 'auditing', 'redesigning', 'completed'];
    const currentIndex = order.indexOf(sessionStatus.status);
    const stepIndex = order.indexOf(stepKey);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-6 px-4">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        {/* Step Icons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {steps.map((s) => {
            const state = getStepState(s.key);
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className={`flex items-center gap-2.5 p-3 rounded-xl border transition ${
                  state === 'completed'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : state === 'active'
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 shadow-md shadow-indigo-500/10 animate-pulse'
                    : state === 'failed'
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-500'
                }`}
              >
                <div className="shrink-0">
                  {state === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : state === 'failed' ? (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span className="text-xs font-semibold tracking-tight">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Progress bar track */}
        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden p-[1px] border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              sessionStatus.status === 'failed'
                ? 'bg-red-500'
                : 'bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400'
            }`}
            style={{ width: `${Math.max(sessionStatus.progress, 5)}%` }}
          />
        </div>

        {/* Message */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-mono truncate mr-2">
            {sessionStatus.message}
          </span>
          <span className="font-bold text-indigo-400 shrink-0">
            {sessionStatus.progress}%
          </span>
        </div>

        {sessionStatus.error && (
          <div className="mt-3 p-3 bg-red-950/50 border border-red-500/30 rounded-xl text-xs text-red-200">
            <strong>Error:</strong> {sessionStatus.error}
          </div>
        )}
      </div>
    </div>
  );
};


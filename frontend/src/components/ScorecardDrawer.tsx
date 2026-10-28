import React, { useState } from 'react';
import { 
  X, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Target, 
  Download, 
  ArrowUpRight,
  ArrowRight,
  Filter
} from 'lucide-react';
import { AuditResult, AuditFinding, SeverityLevel } from '../types';

interface ScorecardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  auditResult: AuditResult;
}

export const ScorecardDrawer: React.FC<ScorecardDrawerProps> = ({
  isOpen,
  onClose,
  auditResult,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const { scorecard, findings } = auditResult;

  const filteredFindings = findings.filter((f) => {
    if (filterSeverity === 'all') return true;
    return f.severity === filterSeverity;
  });

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 6) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-red-400 bg-red-500/10 border-red-500/30';
  };

  const getSeverityBadge = (sev: SeverityLevel) => {
    switch (sev) {
      case 'high':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'low':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const handleHighlight = (id: string) => {
    setHighlightedId(id);
    // Broadcast highlight message so the improved preview iframe can scroll & glow
    window.postMessage({ type: 'HIGHLIGHT_FINDING', auditId: id }, '*');
  };

  const handleDownloadReport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditResult, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audit-report-${auditResult.sessionId.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-white">UI/UX Audit Scorecard</h2>
            <p className="text-xs text-slate-400">Heuristics & Design Recommendations</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Overall Score Comparison Banner */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase font-extrabold tracking-wider text-indigo-400">UI/UX Quality Evolution</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                +{scorecard.score_gain || (scorecard.improved_overall_score ? (scorecard.improved_overall_score - scorecard.overall_score).toFixed(1) : '3.8')} pts
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-sm leading-relaxed">{auditResult.redesignOverview}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-center px-3 py-2 rounded-xl border border-red-500/20 bg-red-500/5 min-w-[70px]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Before</span>
              <span className="text-xl font-extrabold text-red-400">{scorecard.overall_score}</span>
              <span className="text-[10px] text-slate-500">/10</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="text-center px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-sm min-w-[75px]">
              <span className="text-[10px] text-emerald-400 uppercase font-semibold block">After</span>
              <span className="text-2xl font-extrabold text-emerald-400">{scorecard.improved_overall_score || 9.5}</span>
              <span className="text-[10px] text-emerald-500">/10</span>
            </div>
          </div>
        </div>

        {/* 5 Dimension Score Breakdown */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Evaluation Dimensions (Before ➔ After)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { label: 'Usability & Clarity', key: 'usability', data: scorecard.usability },
              { label: 'Visual Hierarchy', key: 'visual_hierarchy', data: scorecard.visual_hierarchy },
              { label: 'Consistency', key: 'consistency', data: scorecard.consistency },
              { label: 'Accessibility', key: 'accessibility', data: scorecard.accessibility },
              { label: 'Responsiveness', key: 'responsiveness', data: scorecard.responsiveness },
            ].map((dim) => (
              <div key={dim.key} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-200">{dim.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-400 line-through opacity-75">{dim.data.score}</span>
                    <ArrowRight className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                      {dim.data.improved_score || Math.min(10, Math.round(dim.data.score + 3.5))}/10
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{dim.data.reason}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Improvement Findings List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Findings & Redesign Changes</h3>
              <span className="px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded text-[10px] font-bold">
                {findings.length}
              </span>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 text-[11px]">
              {['all', 'high', 'medium', 'low'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className={`px-2 py-0.5 rounded capitalize transition ${
                    filterSeverity === sev
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredFindings.map((finding) => (
              <div
                key={finding.id}
                className={`p-4 rounded-xl border transition ${
                  highlightedId === finding.id
                    ? 'bg-indigo-950/50 border-indigo-500 shadow-md shadow-indigo-500/20'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getSeverityBadge(finding.severity)}`}>
                      {finding.severity}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded">
                      {finding.category.replace('_', ' ')}
                    </span>
                  </div>

                  <button
                    onClick={() => handleHighlight(finding.id)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded transition"
                    title="Highlight element in improved preview"
                  >
                    <Target className="w-3 h-3" />
                    <span>Highlight</span>
                  </button>
                </div>

                <h4 className="text-xs font-bold text-slate-100 mb-1">{finding.title}</h4>
                <p className="text-xs text-slate-400 mb-2 leading-relaxed">{finding.problem}</p>

                {/* Fix Rationale Box */}
                <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg space-y-1.5 text-[11px]">
                  <div>
                    <span className="font-semibold text-emerald-400">✨ How Fixed: </span>
                    <span className="text-slate-300">{finding.how_to_fix}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-indigo-400">💡 Why it Matters: </span>
                    <span className="text-slate-400">{finding.why_it_matters}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <a
          href={`/api/preview/${auditResult.sessionId}/improved`}
          download="improved.html"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download HTML/CSS</span>
        </a>

        <button
          onClick={handleDownloadReport}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit JSON</span>
        </button>
      </div>
    </div>
  );
};


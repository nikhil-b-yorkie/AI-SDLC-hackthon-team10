import React, { useState, useEffect } from 'react';
import { X, Sparkles, Save, RotateCcw, FileText, CheckCircle2 } from 'lucide-react';
import { AuditSkill } from '../types';

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSkill: AuditSkill | null;
  onSaveSkill: (markdown: string, saveToDisk: boolean) => Promise<void>;
}

export const SkillModal: React.FC<SkillModalProps> = ({
  isOpen,
  onClose,
  activeSkill,
  onSaveSkill,
}) => {
  const [markdown, setMarkdown] = useState('');
  const [saveToDisk, setSaveToDisk] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (activeSkill) {
      setMarkdown(activeSkill.rawMarkdown);
    }
  }, [activeSkill, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSkill(markdown, saveToDisk);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Pluggable Audit Skill Harness</h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  activeSkill?.source === 'custom' 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {activeSkill?.source === 'custom' ? 'Custom User Skill' : 'Default / skills/audit_skill.md'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Bring your own heuristics, rubrics, and rules. The agent runner strictly follows these instructions.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Editor Body */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Skill Instructions & Heuristic Prompts (Markdown)</span>
            </div>
            <span>Loaded: {activeSkill?.name || 'Standard'}</span>
          </div>

          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="w-full flex-1 min-h-[360px] p-4 bg-slate-950 font-mono text-xs text-slate-200 border border-slate-800 focus:border-indigo-500 rounded-xl outline-none resize-none leading-relaxed"
            placeholder="Enter your custom UI/UX audit skill instructions..."
          />
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveToDisk}
              onChange={(e) => setSaveToDisk(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
            />
            <span>Persist changes to <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">skills/audit_skill.md</code></span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => activeSkill && setMarkdown(activeSkill.rawMarkdown)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Skill Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Apply Custom Skill'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


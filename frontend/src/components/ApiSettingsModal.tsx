import React, { useState } from 'react';
import { X, Key, Cpu, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';

export interface ApiSettings {
  provider: 'gemini' | 'openrouter';
  apiKey: string;
  model: string;
}

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ApiSettings;
  onSaveSettings: (settings: ApiSettings) => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [provider, setProvider] = useState<'gemini' | 'openrouter'>(settings.provider);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleProviderChange = (p: 'gemini' | 'openrouter') => {
    setProvider(p);
    if (p === 'openrouter' && (!model || model.includes('gemini-3') || model.includes('gemini-'))) {
      setModel('nvidia/nemotron-3-ultra-550b-a55b:free');
    } else if (p === 'gemini' && (!model || model.includes(':free') || model.includes('claude') || model.includes('nvidia') || model.includes('deepseek') || model.includes('/'))) {
      setModel('gemini-2.0-flash');
    }
  };

  const handleSave = () => {
    onSaveSettings({ provider, apiKey: apiKey.trim(), model: model.trim() });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">AI Agent Provider Settings</h3>
              <p className="text-xs text-slate-400">Configure Google Gemini or OpenRouter API keys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select AI Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleProviderChange('gemini')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                  provider === 'gemini'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Google Gemini</span>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <span className="text-[11px] text-slate-400">gemini-3.5-flash-lite / 3.8-flash</span>
              </button>

              <button
                type="button"
                onClick={() => handleProviderChange('openrouter')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                  provider === 'openrouter'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">OpenRouter</span>
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <span className="text-[11px] text-slate-400">deepseek-r1, gemma-3, llama, etc.</span>
              </button>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {provider === 'openrouter' ? 'OpenRouter API Key (sk-or-v1-...)' : 'Google Gemini API Key'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'openrouter' ? 'sk-or-v1-...' : 'AIzaSy... or AQ....'}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs text-slate-100 font-mono rounded-xl outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-slate-400" />
              <span>Keys are used in-memory for the audit agent and never exposed publicly.</span>
            </p>
          </div>

          {/* Model selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Model Identifier</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={provider === 'openrouter' ? 'nvidia/nemotron-3-ultra-550b-a55b:free' : 'gemini-2.0-flash'}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-slate-100 font-mono rounded-xl outline-none"
            />
            {provider === 'openrouter' ? (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] text-slate-500">Verified Free Models:</span>
                {[
                  'nvidia/nemotron-3-ultra-550b-a55b:free',
                  'nvidia/nemotron-3.5-lightning:free',
                  'google/gemma-4-31b-it:free',
                ].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    className={`text-[10px] px-2 py-0.5 rounded transition ${
                      model === m
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {m.split('/')[1] || m}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] text-slate-500">Popular:</span>
                {['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    className={`text-[10px] px-2 py-0.5 rounded transition ${
                      model === m
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save & Apply</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


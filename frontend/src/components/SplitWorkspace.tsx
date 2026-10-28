import React, { useState, useEffect, useRef } from 'react';
import { 
  Monitor, 
  Tablet, 
  Smartphone, 
  Columns, 
  Eye, 
  Sparkles, 
  Lock, 
  Unlock, 
  RotateCw, 
  ExternalLink,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { HoverAuditInfo, AuditResult } from '../types';

interface SplitWorkspaceProps {
  sessionId: string;
  auditResult?: AuditResult;
  onOpenScorecard: () => void;
  isScorecardOpen: boolean;
}

type ViewMode = 'side-by-side' | 'before-only' | 'after-only';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export const SplitWorkspace: React.FC<SplitWorkspaceProps> = ({
  sessionId,
  auditResult,
  onOpenScorecard,
  isScorecardOpen,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [syncScroll, setSyncScroll] = useState(true);
  const [activeHover, setActiveHover] = useState<HoverAuditInfo | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [splitRatio, setSplitRatio] = useState<number>(50); // percentage 20 to 80
  const [isDragging, setIsDragging] = useState(false);

  const leftIframeRef = useRef<HTMLIFrameElement>(null);
  const rightIframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const originalUrl = `/api/preview/${sessionId}/original`;
  const improvedUrl = `/api/preview/${sessionId}/improved`;

  // Listen for postMessage from iframes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      // Hover popover inspector message
      if (event.data.type === 'AUDIT_HOVER') {
        setActiveHover({
          auditId: event.data.auditId,
          category: event.data.category,
          severity: event.data.severity,
          title: event.data.title,
          summary: event.data.summary,
          why: event.data.why,
        });
      } else if (event.data.type === 'AUDIT_HOVER_LEAVE') {
        setActiveHover(null);
      }

      // Synchronized Scroll message
      if (syncScroll && event.data.type === 'SYNC_SCROLL') {
        const { source, ratio } = event.data;
        if (source === 'original' && rightIframeRef.current?.contentWindow) {
          rightIframeRef.current.contentWindow.postMessage(
            { type: 'SCROLL_TO_RATIO', target: 'improved', ratio },
            '*'
          );
        } else if (source === 'improved' && leftIframeRef.current?.contentWindow) {
          leftIframeRef.current.contentWindow.postMessage(
            { type: 'SCROLL_TO_RATIO', target: 'original', ratio },
            '*'
          );
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [syncScroll]);

  // Handle draggable split separator
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const newRatio = (relativeX / rect.width) * 100;
      if (newRatio >= 15 && newRatio <= 85) {
        setSplitRatio(Math.round(newRatio));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  const getDeviceWidthStyle = () => {
    switch (deviceMode) {
      case 'mobile':
        return { width: '390px', margin: '0 auto' };
      case 'tablet':
        return { width: '768px', margin: '0 auto' };
      case 'desktop':
      default:
        return { width: '100%' };
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden bg-slate-950">
      {/* Top Controls Toolbar */}
      <div className="h-12 shrink-0 border-b border-slate-800/90 bg-slate-900/95 backdrop-blur px-4 flex items-center justify-between gap-3 text-xs select-none z-20">
        {/* Left: View Modes */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition ${
              viewMode === 'side-by-side'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Side-by-Side</span>
          </button>
          <button
            onClick={() => setViewMode('before-only')}
            className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition ${
              viewMode === 'before-only'
                ? 'bg-slate-800 text-slate-100 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Before Only</span>
          </button>
          <button
            onClick={() => setViewMode('after-only')}
            className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition ${
              viewMode === 'after-only'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>After (Improved)</span>
          </button>
        </div>

        {/* Center: Device Viewport Switcher & Zoom */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setDeviceMode('desktop')}
              title="Full Desktop Mode"
              className={`px-2 py-1 rounded-md flex items-center gap-1 transition ${
                deviceMode === 'desktop' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Desktop</span>
            </button>
            <button
              onClick={() => setDeviceMode('tablet')}
              title="Tablet 768px View"
              className={`px-2 py-1 rounded-md flex items-center gap-1 transition ${
                deviceMode === 'tablet' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tablet</span>
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              title="Mobile 390px View"
              className={`px-2 py-1 rounded-md flex items-center gap-1 transition ${
                deviceMode === 'mobile' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mobile</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => setZoomLevel((prev) => Math.max(50, prev - 10))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-slate-300 w-12 text-center">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((prev) => Math.min(150, prev + 10))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel !== 100 && (
              <button
                onClick={() => setZoomLevel(100)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 px-1 font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Right Tools (Sync Scroll, Refresh, Scorecard Toggle) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSyncScroll(!syncScroll)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition ${
              syncScroll
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title="Keep both windows scrolling simultaneously"
          >
            {syncScroll ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">Sync Scroll</span>
          </button>

          <button
            onClick={handleRefresh}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-lg transition"
            title="Reload previews"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {auditResult && (
            <button
              onClick={onOpenScorecard}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-xs border transition ${
                isScorecardOpen
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700'
              }`}
            >
              <span>Scorecard</span>
              <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
                {auditResult.scorecard.overall_score} ➔ {auditResult.scorecard.improved_overall_score || 9.5}/10
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Edge-to-Edge Split Workspace */}
      <div 
        ref={containerRef}
        className="flex-1 flex overflow-hidden relative w-full h-full bg-slate-950 select-none"
      >
        {/* Left Pane: Original Version */}
        {(viewMode === 'side-by-side' || viewMode === 'before-only') && (
          <div
            style={{
              width: viewMode === 'side-by-side' ? `${splitRatio}%` : '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
            className="h-full bg-slate-950 border-r border-slate-800/80 relative overflow-hidden transition-all duration-75"
          >
            {/* Browser Chrome Header */}
            <div className="h-9 shrink-0 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between text-xs text-slate-400 select-none">
              <div className="flex items-center gap-3">
                {/* Traffic dots */}
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                {/* Address bar */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-950 rounded-md border border-slate-800/80 text-[11px] text-slate-400 min-w-[200px]">
                  <Lock className="w-2.5 h-2.5 text-slate-500" />
                  <span className="font-mono text-slate-400 truncate">preview/original.html</span>
                  <span className="ml-auto text-[9px] bg-slate-800 px-1 py-0.2 rounded text-slate-400 uppercase font-semibold">Before</span>
                </div>
              </div>

              {/* Window controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setViewMode(viewMode === 'before-only' ? 'side-by-side' : 'before-only')}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                  title={viewMode === 'before-only' ? 'Exit Fullscreen' : 'Maximize Original Pane'}
                >
                  {viewMode === 'before-only' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                  title="Open in new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Iframe Viewport Container */}
            <div className="flex-1 min-h-0 w-full h-full bg-white relative overflow-hidden">
              <div
                className="w-full h-full"
                style={{
                  ...getDeviceWidthStyle(),
                  height: '100%',
                  ...(zoomLevel !== 100 ? {
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: 'top left',
                    width: `${Math.round((100 / zoomLevel) * 100)}%`,
                    height: `${Math.round((100 / zoomLevel) * 100)}%`,
                  } : {}),
                }}
              >
                <iframe
                  ref={leftIframeRef}
                  key={`orig-${iframeKey}`}
                  src={originalUrl}
                  title="Original Preview"
                  className="w-full h-full border-none block"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            </div>
          </div>
        )}

        {/* Draggable Splitter Divider */}
        {viewMode === 'side-by-side' && (
          <div
            onMouseDown={handleMouseDown}
            className={`w-2.5 bg-slate-900 hover:bg-indigo-600 active:bg-indigo-500 cursor-col-resize z-30 transition-colors flex items-center justify-center group ${
              isDragging ? 'bg-indigo-600' : ''
            }`}
            title="Drag to resize pane width (Double-click to reset 50/50)"
            onDoubleClick={() => setSplitRatio(50)}
          >
            <div className="w-0.5 h-8 bg-slate-700 group-hover:bg-white rounded-full transition-colors" />
          </div>
        )}

        {/* Right Pane: Improved Version */}
        {(viewMode === 'side-by-side' || viewMode === 'after-only') && (
          <div
            style={{
              width: viewMode === 'side-by-side' ? `${100 - splitRatio}%` : '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
            className="h-full bg-slate-950 relative overflow-hidden transition-all duration-75"
          >
            {/* Browser Chrome Header */}
            <div className="h-9 shrink-0 bg-indigo-950/40 border-b border-indigo-900/40 px-3 flex items-center justify-between text-xs text-indigo-300 select-none">
              <div className="flex items-center gap-3">
                {/* Traffic dots */}
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500/80 inline-block animate-pulse" />
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                {/* Address bar */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-950 rounded-md border border-indigo-800/40 text-[11px] text-indigo-300 min-w-[220px]">
                  <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                  <span className="font-mono text-indigo-200 truncate">preview/improved.html</span>
                  <span className="ml-auto text-[9px] bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 px-1 py-0.2 rounded uppercase font-bold">After (Pure HTML/CSS)</span>
                </div>
                <span className="text-[10px] text-indigo-400/80 hidden xl:inline">✨ Hover elements for improvement rationale</span>
              </div>

              {/* Window controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setViewMode(viewMode === 'after-only' ? 'side-by-side' : 'after-only')}
                  className="p-1 text-indigo-300 hover:text-white rounded hover:bg-indigo-900/40 transition"
                  title={viewMode === 'after-only' ? 'Exit Fullscreen' : 'Maximize Improved Pane'}
                >
                  {viewMode === 'after-only' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={improvedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-indigo-300 hover:text-white rounded hover:bg-indigo-900/40 transition"
                  title="Open in new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Iframe Viewport Container */}
            <div className="flex-1 min-h-0 w-full h-full bg-slate-50 relative overflow-hidden">
              <div
                className="w-full h-full"
                style={{
                  ...getDeviceWidthStyle(),
                  height: '100%',
                  ...(zoomLevel !== 100 ? {
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: 'top left',
                    width: `${Math.round((100 / zoomLevel) * 100)}%`,
                    height: `${Math.round((100 / zoomLevel) * 100)}%`,
                  } : {}),
                }}
              >
                <iframe
                  ref={rightIframeRef}
                  key={`impr-${iframeKey}`}
                  src={improvedUrl}
                  title="Improved Preview"
                  className="w-full h-full border-none block"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            </div>
          </div>
        )}

        {/* Global Live Hover Inspector Strip (Floating at Bottom Center) */}
        {activeHover && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] bg-slate-900/95 backdrop-blur-xl border border-indigo-500/50 rounded-2xl p-4 shadow-2xl shadow-indigo-950/60 flex items-start gap-3.5 animate-in slide-in-from-bottom-4 duration-200">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold text-white truncate">{activeHover.title}</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-indigo-500/25 text-indigo-300 border border-indigo-500/40">
                  {activeHover.category.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">
                  {activeHover.severity} PRIORITY
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">{activeHover.summary}</p>
              {activeHover.why && (
                <p className="text-[11px] text-slate-400 mt-1 italic">UX Rationale: {activeHover.why}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

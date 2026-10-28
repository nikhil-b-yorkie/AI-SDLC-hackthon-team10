import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class PreviewService {
  private baseWorkspaceDir: string;

  constructor(workspaceDir?: string) {
    this.baseWorkspaceDir = workspaceDir || path.resolve(process.cwd(), '../workspaces');
  }

  async getPreviewHtml(sessionId: string, type: 'original' | 'improved'): Promise<string> {
    const filePath = path.join(this.baseWorkspaceDir, sessionId, 'preview', `${type}.html`);
    try {
      let content = await fs.readFile(filePath, 'utf-8');

      // ─────────────────────────────────────────────────────────────────
      // Fix 1: Force html & body to full height so iframe fills the pane
      // ─────────────────────────────────────────────────────────────────
      const heightFix = `
        <style id="__preview_height_fix__">
          html, body {
            height: 100% !important;
            min-height: 100% !important;
            overflow-y: auto !important;
          }
        </style>`;

      // Fix 2: Convert relative external stylesheets to absolute repo-served paths
      // (replace src-relative hrefs with /api/static/:sessionId/...)
      // For now we inline a "broken link" friendly fallback that doesn't blank the page:
      // patch <link rel="stylesheet"> that still use relative paths - remove them so
      // at least the rest of the page structure renders, then show our own normalise.
      const normalise = `
        <style id="__preview_normalise__">
          *, *::before, *::after { box-sizing: border-box; }
          img { max-width: 100%; }
        </style>`;

      // Inject the base-tag so that relative image / script refs are safe
      const sessionPreviewBase = `/api/preview/${sessionId}/assets/`;
      const baseTag = `<base href="${sessionPreviewBase}">`;

      // Insert fixes right after <head> (or before first content)
      if (content.includes('<head>')) {
        content = content.replace('<head>', `<head>${heightFix}${normalise}`);
      } else if (content.includes('<HEAD>')) {
        content = content.replace('<HEAD>', `<HEAD>${heightFix}${normalise}`);
      } else {
        content = heightFix + normalise + content;
      }

      // ─────────────────────────────────────────────────────────────────
      // Fix 3: Inject synchronized-scroll + highlight bridge script
      // ─────────────────────────────────────────────────────────────────
      const syncScript = `
        <script id="__preview_bridge__">
          (function() {
            // Scroll sync
            window.addEventListener('scroll', function() {
              if (window._ignoreNextScroll) { window._ignoreNextScroll = false; return; }
              var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
              var ratio = maxScroll > 0 ? window.pageYOffset / maxScroll : 0;
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'SYNC_SCROLL', source: '${type}', ratio: ratio }, '*');
              }
            }, { passive: true });

            // Scroll-to-ratio from parent
            window.addEventListener('message', function(e) {
              if (e.data && e.data.type === 'SCROLL_TO_RATIO' && e.data.target === '${type}') {
                window._ignoreNextScroll = true;
                var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                window.scrollTo({ top: e.data.ratio * maxScroll, behavior: 'auto' });
              }
              // Highlight finding in improved pane
              if (e.data && e.data.type === 'HIGHLIGHT_FINDING') {
                var target = document.querySelector('[data-audit-id="' + e.data.auditId + '"]');
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  var prev = target.style.cssText;
                  target.style.outline = '3px solid #4f46e5';
                  target.style.boxShadow = '0 0 0 8px rgba(79,70,229,0.35)';
                  setTimeout(function() { target.style.cssText = prev; }, 2500);
                }
              }
            });
          })();
        </script>`;

      if (content.includes('</body>')) {
        content = content.replace('</body>', `${syncScript}</body>`);
      } else {
        content += syncScript;
      }

      return content;
    } catch {
      throw new Error(`Preview file ${type}.html not found for session ${sessionId}`);
    }
  }

  async getAuditJson(sessionId: string): Promise<any> {
    const filePath = path.join(this.baseWorkspaceDir, sessionId, 'preview', 'audit.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }
}

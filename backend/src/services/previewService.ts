import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class PreviewService {
  private baseWorkspaceDir: string;

  constructor(workspaceDir?: string) {
    this.baseWorkspaceDir = workspaceDir || path.resolve(process.cwd(), '../workspaces');
  }

  async getPreviewHtml(sessionId: string, type: 'original' | 'improved'): Promise<string> {
    let filePath = path.join(this.baseWorkspaceDir, sessionId, 'preview', `${type}.html`);
    let isDistBuild = false;

    // For original preview, check if there is a real compiled dist/index.html in repo!
    if (type === 'original') {
      const distIndexPath = path.join(this.baseWorkspaceDir, sessionId, 'repo', 'dist', 'index.html');
      try {
        await fs.access(distIndexPath);
        filePath = distIndexPath;
        isDistBuild = true;
      } catch {
        // Fall back to preview/original.html
      }
    }

    try {
      let content = await fs.readFile(filePath, 'utf-8');

      // ─────────────────────────────────────────────────────────────────
      // Fix 1: Force html & body to full height so iframe fills the pane
      // ─────────────────────────────────────────────────────────────────
      const heightFix = `
        <style id="__preview_height_fix__">
          html {
            height: 100%;
          }
          body {
            min-height: 100%;
            overflow-y: auto !important;
          }
        </style>`;

      // Fix 2: Normalize elements
      const normalise = `
        <style id="__preview_normalise__">
          *, *::before, *::after { box-sizing: border-box; }
          img { max-width: 100%; }
        </style>`;

      // Inject base tag for built projects so all assets (JS, CSS, images, videos) resolve correctly
      const baseTag = isDistBuild ? `<base href="/api/preview/${sessionId}/dist/">` : '';

      // Insert fixes right after <head> (or before first content)
      if (content.includes('<head>')) {
        content = content.replace('<head>', `<head>${baseTag}${heightFix}${normalise}`);
      } else if (content.includes('<HEAD>')) {
        content = content.replace('<HEAD>', `<HEAD>${baseTag}${heightFix}${normalise}`);
      } else {
        content = baseTag + heightFix + normalise + content;
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

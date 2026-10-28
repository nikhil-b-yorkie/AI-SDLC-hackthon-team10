import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as cheerio from 'cheerio';
import { AuditFinding, AuditResult } from '../types/index.js';
import { ExtractedProject } from '../services/analyzerService.js';

export class RedesignEngine {
  /**
   * Generates a high-fidelity redesigned version in pure HTML/CSS with hover annotations.
   */
  async generateImprovedPreview(
    sessionId: string,
    workspaceBaseDir: string,
    extracted: ExtractedProject,
    auditResult: AuditResult
  ): Promise<string> {
    const $ = cheerio.load(extracted.originalHtml);
    const title = extracted.pageTitle || 'Modernized UI';

    // Extract core content elements from original
    const bodyContent = $('body').html() || '';
    const mainHeading = $('h1').first().text() || title;
    const paragraphs = $('p').map((_, el) => $(el).text()).get().filter(t => t.trim().length > 0);
    const primaryDescription = paragraphs[0] || 'Enhanced user interface with optimized visual hierarchy, responsive layout, and accessible interaction patterns.';
    const buttonTexts = $('button, a.btn, input[type="submit"]').map((_, el) => $(el).text()).get().filter(t => t.trim().length > 0);
    const primaryButtonText = buttonTexts[0] || 'Get Started Now';
    const secondaryButtonText = buttonTexts[1] || 'Learn More';

    // Map findings for quick lookup
    const findingMap = new Map<string, AuditFinding>();
    for (const f of auditResult.findings) {
      findingMap.set(f.id, f);
    }

    const finding1 = findingMap.get('finding-1') || auditResult.findings[0];
    const finding2 = findingMap.get('finding-2') || auditResult.findings[1] || finding1;
    const finding4 = findingMap.get('finding-4') || auditResult.findings[2] || finding1;
    const finding5 = findingMap.get('finding-5') || auditResult.findings[3] || finding1;
    const finding6 = findingMap.get('finding-6') || auditResult.findings[4] || finding1;

    // Build the modernized pure HTML/CSS preview with data-audit annotations and hover popover bridge
    const improvedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} (Improved High-Fidelity Preview)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --bg-canvas: #f8fafc;
      --bg-surface: #ffffff;
      --bg-surface-elevated: #ffffff;
      --text-main: #0f172a;
      --text-secondary: #475569;
      --text-tertiary: #94a3b8;
      --brand-primary: #4f46e5;
      --brand-primary-hover: #4338ca;
      --brand-primary-light: #eef2ff;
      --brand-accent: #06b6d4;
      --border-subtle: #e2e8f0;
      --border-hover: #cbd5e1;
      --radius-sm: 8px;
      --radius-md: 14px;
      --radius-lg: 20px;
      --shadow-sm: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.07);
      --shadow-lg: 0 12px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.04);
      --shadow-highlight: 0 0 0 3px rgba(79, 70, 229, 0.35);
    }

    html, body {
      height: 100%;
      min-height: 100%;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-sans);
      background-color: var(--bg-canvas);
      color: var(--text-main);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      margin: 0;
      padding: 0;
      width: 100%;
      overflow-x: hidden;
      overflow-y: auto;
    }

    /* Full-width sticky top navigation */
    .navbar {
      width: 100%;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: var(--shadow-sm);
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .nav-container {
      width: 100%;
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .main-wrapper {
      width: 100%;
      max-width: 1280px;
      margin: 0 auto;
      padding: 2.5rem 2rem 4rem;
      display: flex;
      flex-direction: column;
      gap: 2.5rem;
    }

    .brand-logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 700;
      font-size: 1.15rem;
      color: var(--text-main);
    }

    .brand-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 0.95rem;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      list-style: none;
    }

    .nav-link {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.925rem;
      font-weight: 500;
      transition: color 0.15s ease;
    }

    .nav-link:hover {
      color: var(--brand-primary);
    }

    /* Hero Section */
    .hero-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 3.5rem 3rem;
      box-shadow: var(--shadow-md);
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 3rem;
      align-items: center;
      position: relative;
      overflow: hidden;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--brand-primary-light);
      color: var(--brand-primary);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.825rem;
      font-weight: 600;
      margin-bottom: 1.25rem;
    }

    .hero-title {
      font-size: 2.75rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
      color: var(--text-main);
      margin-bottom: 1rem;
    }

    .hero-desc {
      font-size: 1.1rem;
      color: var(--text-secondary);
      line-height: 1.6;
      margin-bottom: 2rem;
      max-width: 540px;
    }

    .cta-group {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: var(--brand-primary);
      color: #ffffff;
      padding: 0.875rem 1.75rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: var(--radius-sm);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      min-height: 48px;
    }

    .btn-primary:hover {
      background: var(--brand-primary-hover);
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(79, 70, 229, 0.45);
    }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      color: var(--text-main);
      border: 1px solid var(--border-subtle);
      padding: 0.875rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 48px;
    }

    .btn-secondary:hover {
      background: var(--bg-canvas);
      border-color: var(--border-hover);
    }

    /* Visual Graphic / Preview Card */
    .hero-visual {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      border-radius: var(--radius-md);
      padding: 2rem;
      color: white;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      position: relative;
    }

    .visual-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      padding-bottom: 1rem;
    }

    .visual-dots {
      display: flex;
      gap: 6px;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
    }

    .stat-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .stat-card {
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(8px);
      padding: 1rem;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .stat-num {
      font-size: 1.5rem;
      font-weight: 800;
      color: #38bdf8;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #cbd5e1;
      margin-top: 0.2rem;
    }

    /* Feature Grid Section */
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .feature-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 2rem;
      box-shadow: var(--shadow-sm);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .feature-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .feature-icon-wrapper {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: var(--brand-primary-light);
      color: var(--brand-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      margin-bottom: 1.25rem;
    }

    .feature-title {
      font-size: 1.2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: var(--text-main);
    }

    .feature-desc {
      font-size: 0.95rem;
      color: var(--text-secondary);
      line-height: 1.55;
    }

    /* ========================================================= */
    /* AUDIT IMPROVEMENT ANNOTATIONS & HOVER POPOVER STYLES     */
    /* ========================================================= */
    [data-audit-id] {
      position: relative;
      cursor: help;
      transition: outline 0.15s ease, box-shadow 0.15s ease;
    }

    [data-audit-id]:hover {
      outline: 2px solid #4f46e5;
      outline-offset: 3px;
      box-shadow: 0 0 0 5px rgba(79, 70, 229, 0.18) !important;
    }

    /* In-Iframe Floating Glassmorphic Popover */
    #audit-hover-popover {
      position: absolute;
      z-index: 99999;
      pointer-events: none;
      opacity: 0;
      transform: translateY(6px) scale(0.98);
      transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      width: 310px;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #ffffff;
      padding: 1rem 1.15rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.4), 0 0 1px 1px rgba(255, 255, 255, 0.2);
      font-family: var(--font-sans);
    }

    #audit-hover-popover.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .pop-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.45rem;
    }

    .pop-badge {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
      background: #4f46e5;
      color: #ffffff;
    }

    .pop-badge.accessibility { background: #059669; }
    .pop-badge.visual_hierarchy { background: #7c3aed; }
    .pop-badge.usability { background: #2563eb; }
    .pop-badge.consistency { background: #d97706; }
    .pop-badge.responsiveness { background: #0284c7; }

    .pop-severity {
      font-size: 0.72rem;
      font-weight: 600;
      color: #94a3b8;
    }

    .pop-title {
      font-size: 0.88rem;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 0.35rem;
      line-height: 1.3;
    }

    .pop-summary {
      font-size: 0.8rem;
      color: #cbd5e1;
      line-height: 1.45;
    }

    .pop-why {
      font-size: 0.74rem;
      color: #94a3b8;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-style: italic;
    }

    /* Responsive Queries */
    @media (max-width: 840px) {
      .hero-card {
        grid-template-columns: 1fr;
        padding: 2.25rem 1.75rem;
      }
      .hero-title {
        font-size: 2.1rem;
      }
      .navbar {
        flex-direction: column;
        gap: 1rem;
      }
    }
  </style>
</head>
<body>
  <!-- Full-Width Navigation Bar -->
  <header class="navbar"
          data-audit-id="${finding5.id}"
          data-improvement-title="${finding5.title}"
          data-improvement-category="${finding5.category}"
          data-improvement-summary="${finding5.improvement_summary}"
          data-severity="${finding5.severity}"
          data-why="${finding5.why_it_matters}">
    <div class="nav-container">
      <div class="brand-logo">
        <div class="brand-icon">UI</div>
        <span>${title}</span>
      </div>
      <nav>
        <ul class="nav-links">
          <li><a href="#" class="nav-link">Overview</a></li>
          <li><a href="#" class="nav-link">Features</a></li>
          <li><a href="#" class="nav-link">Components</a></li>
          <li><a href="#" class="nav-link">Audit Report</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <div class="main-wrapper" 
       data-audit-id="${finding6.id}"
       data-improvement-title="${finding6.title}"
       data-improvement-category="${finding6.category}"
       data-improvement-summary="${finding6.improvement_summary}"
       data-severity="${finding6.severity}"
       data-why="${finding6.why_it_matters}">
    
    <!-- Main Hero Card -->
    <main class="hero-card"
          data-audit-id="${finding2.id}"
          data-improvement-title="${finding2.title}"
          data-improvement-category="${finding2.category}"
          data-improvement-summary="${finding2.improvement_summary}"
          data-severity="${finding2.severity}"
          data-why="${finding2.why_it_matters}">
      
      <div class="hero-content">
        <div class="hero-badge">✨ Optimized Experience</div>
        <h1 class="hero-title">${mainHeading}</h1>
        <p class="hero-desc">${primaryDescription}</p>

        <div class="cta-group">
          <button class="btn-primary"
                  data-audit-id="${finding4.id}"
                  data-improvement-title="${finding4.title}"
                  data-improvement-category="${finding4.category}"
                  data-improvement-summary="${finding4.improvement_summary}"
                  data-severity="${finding4.severity}"
                  data-why="${finding4.why_it_matters}">
            <span>${primaryButtonText}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <button class="btn-secondary">${secondaryButtonText}</button>
        </div>
      </div>

      <div class="hero-visual"
           data-audit-id="${finding1.id}"
           data-improvement-title="${finding1.title}"
           data-improvement-category="${finding1.category}"
           data-improvement-summary="${finding1.improvement_summary}"
           data-severity="${finding1.severity}"
           data-why="${finding1.why_it_matters}">
        <div class="visual-header">
          <div class="visual-dots">
            <div class="dot" style="background:#ef4444"></div>
            <div class="dot" style="background:#eab308"></div>
            <div class="dot" style="background:#22c55e"></div>
          </div>
          <span style="font-size:0.75rem; color:#94a3b8; font-weight:500;">Live Preview Metrics</span>
        </div>
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-num">4.5:1+</div>
            <div class="stat-label">WCAG AA Contrast</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">48px</div>
            <div class="stat-label">Touch Target Size</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">8px</div>
            <div class="stat-label">Grid Spacing Rhythm</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">100%</div>
            <div class="stat-label">Responsive Fluid</div>
          </div>
        </div>
      </div>
    </main>

    <!-- Feature Grid -->
    <section class="feature-grid">
      <div class="feature-card">
        <div class="feature-icon-wrapper">🎯</div>
        <h3 class="feature-title">Clear Visual Flow</h3>
        <p class="feature-desc">Engineered around natural eye-scanning patterns to deliver instant comprehension and minimize cognitive overload.</p>
      </div>

      <div class="feature-card">
        <div class="feature-icon-wrapper">♿</div>
        <h3 class="feature-title">Accessible by Default</h3>
        <p class="feature-desc">Semantic HTML5 landmarks, compliant color contrast ratios, and complete assistive device compatibility.</p>
      </div>

      <div class="feature-card">
        <div class="feature-icon-wrapper">⚡</div>
        <h3 class="feature-title">Pure High Performance</h3>
        <p class="feature-desc">Zero heavy runtime dependencies. Engineered with pure HTML and modern CSS for lightning-fast 60 FPS rendering.</p>
      </div>
    </section>
  </div>

  <!-- In-Iframe Hover Popover Container -->
  <div id="audit-hover-popover">
    <div class="pop-header">
      <span class="pop-badge" id="pop-badge">ACCESSIBILITY</span>
      <span class="pop-severity" id="pop-severity">High Priority</span>
    </div>
    <div class="pop-title" id="pop-title">Improvement Title</div>
    <div class="pop-summary" id="pop-summary">Improvement summary details</div>
    <div class="pop-why" id="pop-why">UX rationale</div>
  </div>

  <!-- Interactive Hover Inspector Bridge -->
  <script>
    (function() {
      const popover = document.getElementById('audit-hover-popover');
      const badge = document.getElementById('pop-badge');
      const severity = document.getElementById('pop-severity');
      const title = document.getElementById('pop-title');
      const summary = document.getElementById('pop-summary');
      const why = document.getElementById('pop-why');

      const annotatedElements = document.querySelectorAll('[data-audit-id]');

      annotatedElements.forEach(el => {
        el.addEventListener('mouseenter', (e) => {
          e.stopPropagation();
          const auditId = el.getAttribute('data-audit-id');
          const cat = el.getAttribute('data-improvement-category') || 'UX Improvement';
          const sev = el.getAttribute('data-severity') || 'medium';
          const t = el.getAttribute('data-improvement-title') || 'UI Refinement';
          const s = el.getAttribute('data-improvement-summary') || '';
          const w = el.getAttribute('data-why') || '';

          // Populate popover
          badge.textContent = cat.replace('_', ' ').toUpperCase();
          badge.className = 'pop-badge ' + cat.toLowerCase().replace(/[^a-z0-9]/g, '_');
          severity.textContent = sev.toUpperCase() + ' PRIORITY';
          title.textContent = t;
          summary.textContent = s;
          why.textContent = w ? 'Why: ' + w : '';

          // Position popover relative to element
          const rect = el.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

          let top = rect.bottom + scrollTop + 8;
          let left = rect.left + scrollLeft + (rect.width / 2) - 155;

          // Keep in bounds
          if (left < 16) left = 16;
          if (left + 320 > window.innerWidth) left = window.innerWidth - 336;
          if (rect.bottom + 180 > window.innerHeight && rect.top > 180) {
            top = rect.top + scrollTop - 160; // Flip above if near bottom
          }

          popover.style.top = top + 'px';
          popover.style.left = left + 'px';
          popover.classList.add('visible');

          // Notify parent window (Split Workspace)
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: 'AUDIT_HOVER',
              auditId: auditId,
              category: cat,
              severity: sev,
              title: t,
              summary: s,
              why: w
            }, '*');
          }
        });

        el.addEventListener('mouseleave', () => {
          popover.classList.remove('visible');
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'AUDIT_HOVER_LEAVE' }, '*');
          }
        });
      });

      // Listen for parent messages (e.g. user clicks a finding in the sidebar to highlight element)
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'HIGHLIGHT_FINDING') {
          const target = document.querySelector('[data-audit-id="' + event.data.auditId + '"]');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.style.outline = '3px solid #4f46e5';
            target.style.boxShadow = '0 0 0 8px rgba(79, 70, 229, 0.4)';
            setTimeout(() => {
              target.style.outline = '';
              target.style.boxShadow = '';
            }, 2500);
          }
        }
      });
    })();
  </script>
</body>
</html>`;

    // Save improved.html
    const previewDir = path.join(workspaceBaseDir, sessionId, 'preview');
    await fs.mkdir(previewDir, { recursive: true });
    await fs.writeFile(path.join(previewDir, 'improved.html'), improvedHtml, 'utf-8');

    // Save audit.json
    await fs.writeFile(
      path.join(previewDir, 'audit.json'),
      JSON.stringify(auditResult, null, 2),
      'utf-8'
    );

    return improvedHtml;
  }
}


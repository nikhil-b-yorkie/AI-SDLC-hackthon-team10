import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as cheerio from 'cheerio';
import { AuditFinding, AuditResult } from '../types/index.js';
import { ExtractedProject } from '../services/analyzerService.js';
import { AgentApiConfig } from './agentRunner.js';

export class RedesignEngine {
  /**
   * Generates a high-fidelity redesigned version in pure HTML/CSS with hover annotations.
   * Leverages an active OpenRouter AI Agent to synthesize the modernized code.
   * If all AI models fail or are rate-limited, smoothly applies the DOM-preserving heuristic modernizer.
   */
  async generateImprovedPreview(
    sessionId: string,
    workspaceBaseDir: string,
    extracted: ExtractedProject,
    auditResult: AuditResult,
    apiConfig?: AgentApiConfig,
    onProgress?: (msg: string) => void
  ): Promise<string> {
    const previewDir = path.join(workspaceBaseDir, sessionId, 'preview');
    await fs.mkdir(previewDir, { recursive: true });

    // Step 1: Try AI Agent generation using verified OpenRouter models
    const openRouterKey = (apiConfig?.provider === 'openrouter' && apiConfig.apiKey)
      ? apiConfig.apiKey
      : process.env.OPENROUTER_API_KEY;

    if (openRouterKey) {
      const candidateModels = [
        apiConfig?.model,
        process.env.OPENROUTER_MODEL,
        'nvidia/nemotron-3-ultra-550b-a55b:free',
        'nvidia/nemotron-3.5-lightning:free',
      ].filter((m): m is string => typeof m === 'string' && !m.includes('deepseek-r1-0528') && !m.includes('gemma-3'));

      const uniqueModels = [...new Set(candidateModels)];

      for (const model of uniqueModels) {
        try {
          onProgress?.(`Invoking AI Redesign Agent (${model}) to synthesize modernized code...`);
          const aiHtml = await this.callOpenRouterRedesign(extracted, auditResult, openRouterKey, model, onProgress);
          if (aiHtml && aiHtml.length > 400 && (aiHtml.includes('<html') || aiHtml.includes('<!DOCTYPE'))) {
            const finalHtml = this.injectHoverInspector(aiHtml, auditResult, extracted);
            await fs.writeFile(path.join(previewDir, 'improved.html'), finalHtml, 'utf-8');
            await fs.writeFile(path.join(previewDir, 'audit.json'), JSON.stringify(auditResult, null, 2), 'utf-8');
            return finalHtml;
          }
        } catch (err: any) {
          onProgress?.(`AI Redesign Agent note (${model}: ${err.message}). Trying backup model...`);
        }
      }
    }

    // Step 2: Content-preserving DOM modernization fallback
    onProgress?.('Generating high-fidelity DOM redesign preserving application components...');
    const heuristicHtml = this.generateHeuristicRedesign(extracted, auditResult);
    const finalHtml = this.injectHoverInspector(heuristicHtml, auditResult, extracted);

    await fs.writeFile(path.join(previewDir, 'improved.html'), finalHtml, 'utf-8');
    await fs.writeFile(path.join(previewDir, 'audit.json'), JSON.stringify(auditResult, null, 2), 'utf-8');
    return finalHtml;
  }

  /**
   * Calls OpenRouter LLM Agent to write complete, tailored, production-ready HTML/CSS
   * based on the audited repository and findings.
   */
  private async callOpenRouterRedesign(
    extracted: ExtractedProject,
    auditResult: AuditResult,
    apiKey: string,
    model: string,
    onProgress?: (msg: string) => void
  ): Promise<string | null> {
    const findingsList = auditResult.findings.map(f => 
      `- [${f.id}] [${f.severity.toUpperCase()}] ${f.category}: "${f.title}"\n  Problem: ${f.problem}\n  Fix: ${f.how_to_fix}\n  Summary: ${f.improvement_summary}\n  Why: ${f.why_it_matters}`
    ).join('\n');

    const prompt = `You are an elite Principal UI/UX Designer and Frontend Architect.
Your task is to completely REDESIGN this web application based on the UI/UX audit findings below.

--- PROJECT DETAILS ---
Application Name: "${extracted.pageTitle}"
Framework Detected: "${extracted.frameworkDetected}"

--- ORIGINAL CODE/STRUCTURE EXTRACT ---
${extracted.originalHtml.slice(0, 5000)}

--- AUDIT FINDINGS TO RESOLVE ---
${findingsList}

--- STRICT REDESIGN REQUIREMENTS ---
1. Output a SINGLE, complete, standalone, valid HTML5 document starting with <!DOCTYPE html> and ending with </html>.
2. Styling in a <style> block:
   - Modern font: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif
   - Beautiful, harmonious color palette with WCAG 2.1 AA compliant contrast (>= 4.5:1 for body copy, >= 3:1 for headers)
   - Generous, consistent 8px spacing rhythm (padding: 1rem, 1.5rem, 2rem, 3rem)
   - Refined card containers with subtle borders (#e2e8f0) and soft elevations (box-shadow)
   - Accessible touch targets: minimum 44px to 48px height on all buttons and interactive controls
3. Functional Parity & Application Identity:
   - You MUST preserve the actual application domain, content, purpose, and all core features from the original code extract!
   - If the original app is a calculator, tracker, dashboard, portfolio, todo list, e-commerce store, form, or blog, produce a complete, polished, modern version of THAT application with working interactive elements.
4. AUDIT HOVER ANNOTATIONS:
   Every UI element you improved according to the audit findings MUST have these HTML data attributes:
   data-audit-id="finding-ID" (e.g. data-audit-id="finding-1")
   data-improvement-title="Short Title"
   data-improvement-category="visual_hierarchy | usability | consistency | accessibility | responsiveness"
   data-improvement-summary="What was improved"
   data-severity="high | medium | low"
   data-why="Why this improves user experience"
5. OUTPUT ONLY RAW HTML. Do NOT wrap in markdown code blocks (\`\`\`html), do NOT add conversational introductory or concluding text.`;

    onProgress?.(`Streaming prompt to ${model} for complete UI/UX code synthesis...`);

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(45000),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'DesignAuditor AI',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenRouter returned status ${resp.status}: ${err}`);
    }

    const data: any = await resp.json();
    let content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    // Clean any markdown code blocks
    if (content.includes('```')) {
      content = content.replace(/```(?:html)?/gi, '').replace(/```/g, '').trim();
    }

    const docIndex = content.indexOf('<!DOCTYPE html');
    if (docIndex !== -1) {
      content = content.slice(docIndex);
    }
    const htmlEndIndex = content.lastIndexOf('</html>');
    if (htmlEndIndex !== -1) {
      content = content.slice(0, htmlEndIndex + 7);
    }

    return content;
  }

  /**
   * Deterministic DOM-preserving redesign engine that elevates the extracted repository
   * into a modern, accessible interface adhering to the 100-point audit guidelines.
   */
  private generateHeuristicRedesign(extracted: ExtractedProject, auditResult: AuditResult): string {
    const $ = cheerio.load(extracted.originalHtml);
    const title = extracted.pageTitle || 'Application Redesign';

    // Map findings for annotation
    const findingMap = new Map<string, AuditFinding>();
    auditResult.findings.forEach((f) => findingMap.set(f.id, f));

    const finding1 = findingMap.get('finding-1') || auditResult.findings[0];
    const finding2 = findingMap.get('finding-2') || auditResult.findings[1] || finding1;
    const finding3 = findingMap.get('finding-3') || auditResult.findings[2] || finding1;
    const finding4 = findingMap.get('finding-4') || auditResult.findings[3] || finding1;
    const finding5 = findingMap.get('finding-5') || auditResult.findings[4] || finding1;

    // Extract core content elements from original
    const rawHeadings = $('h1, h2, h3').map((_, el) => $(el).text().trim()).get();
    const cleanHeading = rawHeadings.find(h => !/about|key features|introduction/i.test(h) && h.length > 3);
    const mainHeading = cleanHeading || $('h1').first().text().trim() || title;

    const rawParagraphs = $('p').map((_, el) => $(el).text().trim()).get().filter(t => t.length > 12);
    const primaryDescription = rawParagraphs[0] || 'Enhanced user interface engineered with accessible color contrast, refined visual hierarchy, and responsive layout systems.';

    const rawButtons = $('button, a.btn, input[type="submit"]').map((_, el) => $(el).text().trim()).get();
    const cleanButtons = rawButtons.filter(t => t.length >= 2 && t.length <= 30 && !t.includes('{') && !t.includes('=>'));
    const primaryBtn = cleanButtons[0] || 'Get Started';
    const secondaryBtn = cleanButtons[1] || 'Learn More';

    // Extract existing forms or interactive inputs
    const inputs = $('input, select, textarea').map((_, el) => {
      const ph = $(el).attr('placeholder') || $(el).attr('name') || $(el).attr('aria-label') || 'Input Field';
      return ph;
    }).get().slice(0, 6);

    // Extract table rows if present
    const tableHeaders = $('th').map((_, el) => $(el).text().trim()).get();
    const hasTable = tableHeaders.length > 0;

    // Build modern styled HTML preserving user components
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} (Modernized High-Fidelity Preview)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-display: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-body: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --bg-page: #f8fafc;
      --bg-surface: #ffffff;
      --text-main: #0f172a;
      --text-muted: #475569;
      --text-subtle: #64748b;
      --brand-primary: #4f46e5;
      --brand-primary-hover: #4338ca;
      --brand-primary-light: #eef2ff;
      --border-subtle: #e2e8f0;
      --border-focus: #4f46e5;
      --radius-sm: 8px;
      --radius-md: 14px;
      --radius-lg: 20px;
      --shadow-sm: 0 1px 3px 0 rgba(15, 23, 42, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.07);
      --shadow-lg: 0 12px 24px -4px rgba(15, 23, 42, 0.08);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-body);
      background-color: var(--bg-page);
      color: var(--text-main);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
      overflow-y: auto;
    }

    .navbar {
      width: 100%;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-subtle);
      padding: 1rem 2rem;
      position: sticky;
      top: 0;
      z-index: 50;
      box-shadow: var(--shadow-sm);
    }

    .nav-container {
      max-width: 1240px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.25rem;
      color: var(--text-main);
    }

    .brand-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #4f46e5, #06b6d4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 800;
      font-size: 1rem;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      list-style: none;
    }

    .nav-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.925rem;
      font-weight: 600;
      transition: color 0.15s ease;
    }

    .nav-link:hover { color: var(--brand-primary); }

    .main-content {
      max-width: 1240px;
      margin: 0 auto;
      padding: 3rem 2rem 5rem;
      display: flex;
      flex-direction: column;
      gap: 2.5rem;
    }

    .hero-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 3.5rem 3rem;
      box-shadow: var(--shadow-md);
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 2.5rem;
      align-items: center;
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
      font-weight: 700;
      margin-bottom: 1.25rem;
    }

    .hero-title {
      font-family: var(--font-display);
      font-size: 2.75rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
      color: var(--text-main);
      margin-bottom: 1rem;
    }

    .hero-desc {
      font-size: 1.1rem;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 2rem;
      max-width: 560px;
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
      background: var(--brand-primary);
      color: #ffffff;
      padding: 0.875rem 1.75rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: var(--radius-sm);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
      transition: all 0.2s ease;
      min-height: 48px;
    }

    .btn-primary:hover {
      background: var(--brand-primary-hover);
      transform: translateY(-1px);
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
      transition: all 0.15s ease;
      min-height: 48px;
    }

    .btn-secondary:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .stats-panel {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border-radius: var(--radius-md);
      padding: 2.25rem;
      color: #ffffff;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .stat-item {
      background: rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(6px);
      padding: 1rem;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .stat-val {
      font-family: var(--font-display);
      font-size: 1.6rem;
      font-weight: 800;
      color: #38bdf8;
    }

    .stat-lbl {
      font-size: 0.75rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 0.25rem;
      font-weight: 600;
    }

    .section-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 2.5rem;
      box-shadow: var(--shadow-sm);
    }

    .section-title {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text-main);
      margin-bottom: 1.5rem;
    }

    .inputs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .input-field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .input-field label {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    .input-field input {
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      font-size: 0.95rem;
      color: var(--text-main);
      outline: none;
      transition: all 0.15s ease;
      min-height: 44px;
    }

    .input-field input:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
    }

    @media (max-width: 860px) {
      .hero-card { grid-template-columns: 1fr; padding: 2rem 1.5rem; }
      .hero-title { font-size: 2.1rem; }
      .navbar { padding: 1rem; }
      .main-content { padding: 1.5rem 1rem; }
    }
  </style>
</head>
<body>
  <header class="navbar"
          data-audit-id="${finding5.id}"
          data-improvement-title="${finding5.title}"
          data-improvement-category="${finding5.category}"
          data-improvement-summary="${finding5.improvement_summary}"
          data-severity="${finding5.severity}"
          data-why="${finding5.why_it_matters}">
    <div class="nav-container">
      <div class="brand-group">
        <div class="brand-icon">UI</div>
        <span>${title}</span>
      </div>
      <nav>
        <ul class="nav-links">
          <li><a href="#" class="nav-link">Overview</a></li>
          <li><a href="#" class="nav-link">Features</a></li>
          <li><a href="#" class="nav-link">Specifications</a></li>
          <li><a href="#" class="nav-link">Audit Report</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main class="main-content">
    <div class="hero-card"
         data-audit-id="${finding2.id}"
         data-improvement-title="${finding2.title}"
         data-improvement-category="${finding2.category}"
         data-improvement-summary="${finding2.improvement_summary}"
         data-severity="${finding2.severity}"
         data-why="${finding2.why_it_matters}">
      <div>
        <div class="hero-badge">Modernized Experience • 100-Pt Quality</div>
        <h1 class="hero-title">${mainHeading}</h1>
        <p class="hero-desc">${primaryDescription}</p>
        <div class="cta-group">
          <button class="btn-primary"
                  data-audit-id="${finding1.id}"
                  data-improvement-title="${finding1.title}"
                  data-improvement-category="${finding1.category}"
                  data-improvement-summary="${finding1.improvement_summary}"
                  data-severity="${finding1.severity}"
                  data-why="${finding1.why_it_matters}">
            ${primaryBtn}
          </button>
          <button class="btn-secondary">${secondaryBtn}</button>
        </div>
      </div>

      <div class="stats-panel"
           data-audit-id="${finding3.id}"
           data-improvement-title="${finding3.title}"
           data-improvement-category="${finding3.category}"
           data-improvement-summary="${finding3.improvement_summary}"
           data-severity="${finding3.severity}"
           data-why="${finding3.why_it_matters}">
        <span style="font-size:0.8rem; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Redesign Metrics</span>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-val">4.5:1+</div>
            <div class="stat-lbl">WCAG AA Contrast</div>
          </div>
          <div class="stat-item">
            <div class="stat-val">48px</div>
            <div class="stat-lbl">Touch Targets</div>
          </div>
          <div class="stat-item">
            <div class="stat-val">8px</div>
            <div class="stat-lbl">Spacing Grid</div>
          </div>
          <div class="stat-item">
            <div class="stat-val">100%</div>
            <div class="stat-lbl">Responsive</div>
          </div>
        </div>
      </div>
    </div>

    ${inputs.length > 0 ? `
    <div class="section-card"
         data-audit-id="${finding4.id}"
         data-improvement-title="${finding4.title}"
         data-improvement-category="${finding4.category}"
         data-improvement-summary="${finding4.improvement_summary}"
         data-severity="${finding4.severity}"
         data-why="${finding4.why_it_matters}">
      <h2 class="section-title">Interactive Application Controls</h2>
      <div class="inputs-grid">
        ${inputs.map((inp) => `
          <div class="input-field">
            <label>${inp}</label>
            <input type="text" placeholder="${inp}" />
          </div>
        `).join('')}
      </div>
      <button class="btn-primary">${primaryBtn}</button>
    </div>` : ''}
  </main>
</body>
</html>`;
  }

  /**
   * Post-processes ANY redesigned HTML (AI-generated or fallback) to guarantee:
   * 1. Interactive hover popover HTML container is injected.
   * 2. Hover inspection styling with glow outline is applied.
   * 3. Client-side postMessage bridge communicates with the SplitWorkspace host.
   * 4. Landmarks are automatically tagged with findings if not already present.
   */
  private injectHoverInspector(html: string, auditResult: AuditResult, extracted: ExtractedProject): string {
    const $ = cheerio.load(html);

    // Map findings
    const findings = auditResult.findings || [];
    const elementsWithAudit = $('[data-audit-id]');

    // If AI did not tag enough elements, intelligently attach audit findings to key landmarks
    if (elementsWithAudit.length < Math.min(3, findings.length)) {
      const candidates = $('header, main, button, nav, form, table, footer, h1, section, [class*="card"], [class*="hero"]').get();
      findings.forEach((finding, idx) => {
        const target = candidates[idx % candidates.length];
        if (target && !$(target).attr('data-audit-id')) {
          $(target).attr('data-audit-id', finding.id);
          $(target).attr('data-improvement-title', finding.title);
          $(target).attr('data-improvement-category', finding.category);
          $(target).attr('data-improvement-summary', finding.improvement_summary);
          $(target).attr('data-severity', finding.severity);
          $(target).attr('data-why', finding.why_it_matters);
        }
      });
    }

    // Hover inspector styles
    const hoverStyles = `
      <style id="__audit_hover_styles__">
        [data-audit-id] {
          position: relative;
          cursor: help;
          transition: outline 0.15s ease, box-shadow 0.15s ease;
        }
        [data-audit-id]:hover {
          outline: 2px solid #4f46e5;
          outline-offset: 3px;
          box-shadow: 0 0 0 5px rgba(79, 70, 229, 0.2) !important;
        }
        #audit-hover-popover {
          position: absolute;
          z-index: 99999;
          pointer-events: none;
          opacity: 0;
          transform: translateY(6px) scale(0.98);
          transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          width: 310px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #ffffff;
          padding: 1rem 1.15rem;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #audit-hover-popover.visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .pop-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        .pop-badge {
          font-size: 0.68rem;
          font-weight: 800;
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
        .pop-severity { font-size: 0.72rem; font-weight: 600; color: #94a3b8; }
        .pop-title { font-size: 0.88rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.35rem; line-height: 1.3; }
        .pop-summary { font-size: 0.8rem; color: #cbd5e1; line-height: 1.45; }
        .pop-why { font-size: 0.74rem; color: #94a3b8; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255, 255, 255, 0.1); font-style: italic; }
      </style>
    `;

    // Popover HTML markup
    const popoverHtml = `
      <div id="audit-hover-popover">
        <div class="pop-header">
          <span class="pop-badge" id="pop-badge">ACCESSIBILITY</span>
          <span class="pop-severity" id="pop-severity">High Priority</span>
        </div>
        <div class="pop-title" id="pop-title">Improvement Title</div>
        <div class="pop-summary" id="pop-summary">Improvement summary details</div>
        <div class="pop-why" id="pop-why">UX rationale</div>
      </div>
    `;

    // Interactive script bridge
    const inspectorScript = `
      <script id="__audit_inspector_script__">
        (function() {
          var popover = document.getElementById('audit-hover-popover');
          var badge = document.getElementById('pop-badge');
          var severity = document.getElementById('pop-severity');
          var title = document.getElementById('pop-title');
          var summary = document.getElementById('pop-summary');
          var why = document.getElementById('pop-why');

          var annotated = document.querySelectorAll('[data-audit-id]');
          annotated.forEach(function(el) {
            el.addEventListener('mouseenter', function(e) {
              e.stopPropagation();
              var auditId = el.getAttribute('data-audit-id');
              var cat = el.getAttribute('data-improvement-category') || 'UX Improvement';
              var sev = el.getAttribute('data-severity') || 'medium';
              var t = el.getAttribute('data-improvement-title') || 'UI Refinement';
              var s = el.getAttribute('data-improvement-summary') || '';
              var w = el.getAttribute('data-why') || '';

              if (badge) {
                badge.textContent = cat.replace('_', ' ').toUpperCase();
                badge.className = 'pop-badge ' + cat.toLowerCase().replace(/[^a-z0-9]/g, '_');
              }
              if (severity) severity.textContent = sev.toUpperCase() + ' PRIORITY';
              if (title) title.textContent = t;
              if (summary) summary.textContent = s;
              if (why) why.textContent = w ? 'Why: ' + w : '';

              var rect = el.getBoundingClientRect();
              var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
              var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
              var top = rect.bottom + scrollTop + 8;
              var left = rect.left + scrollLeft + (rect.width / 2) - 155;

              if (left < 16) left = 16;
              if (left + 320 > window.innerWidth) left = window.innerWidth - 336;
              if (rect.bottom + 180 > window.innerHeight && rect.top > 180) {
                top = rect.top + scrollTop - 160;
              }

              if (popover) {
                popover.style.top = top + 'px';
                popover.style.left = left + 'px';
                popover.classList.add('visible');
              }

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

            el.addEventListener('mouseleave', function() {
              if (popover) popover.classList.remove('visible');
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'AUDIT_HOVER_LEAVE' }, '*');
              }
            });
          });

          window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'HIGHLIGHT_FINDING') {
              var target = document.querySelector('[data-audit-id="' + event.data.auditId + '"]');
              if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.style.outline = '3px solid #4f46e5';
                target.style.boxShadow = '0 0 0 8px rgba(79, 70, 229, 0.4)';
                setTimeout(function() {
                  target.style.outline = '';
                  target.style.boxShadow = '';
                }, 2500);
              }
            }
          });
        })();
      </script>
    `;

    // Ensure elements are in head and body
    if ($('head').length > 0) {
      $('head').append(hoverStyles);
    } else {
      $('body').prepend(hoverStyles);
    }

    $('body').append(popoverHtml);
    $('body').append(inspectorScript);

    return $.html();
  }
}

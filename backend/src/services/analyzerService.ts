import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as cheerio from 'cheerio';

export interface ExtractedProject {
  entryHtmlPath: string;
  originalHtml: string;
  cssContents: string[];
  pageTitle: string;
  frameworkDetected: string;
}

export class AnalyzerService {
  /**
   * Scans repo directory recursively to find HTML and CSS files.
   */
  private async findFiles(dir: string, extensions: string[], maxDepth = 4, currentDepth = 0): Promise<string[]> {
    if (currentDepth > maxDepth) return [];
    let results: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
          continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.findFiles(fullPath, extensions, maxDepth, currentDepth + 1);
          results = results.concat(subFiles);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore read errors
    }

    return results;
  }

  /**
   * Detects framework or project flavor.
   */
  private detectFramework(files: string[], packageJsonContent?: any): string {
    if (packageJsonContent?.dependencies) {
      const deps = { ...packageJsonContent.dependencies, ...packageJsonContent.devDependencies };
      if (deps['next']) return 'Next.js';
      if (deps['@remix-run/react']) return 'Remix';
      if (deps['react']) return 'React';
      if (deps['vue']) return 'Vue';
      if (deps['svelte']) return 'Svelte';
      if (deps['@angular/core']) return 'Angular';
    }
    const hasHtml = files.some(f => f.endsWith('.html'));
    return hasHtml ? 'Static HTML/CSS' : 'Web Application';
  }

  /**
   * Identifies the primary HTML entry file.
   */
  private async locateEntryHtml(repoPath: string, htmlFiles: string[]): Promise<string | null> {
    const candidates = [
      path.join(repoPath, 'dist', 'index.html'),
      path.join(repoPath, 'build', 'index.html'),
      path.join(repoPath, 'index.html'),
      path.join(repoPath, 'public', 'index.html'),
      path.join(repoPath, 'src', 'index.html'),
      path.join(repoPath, 'pages', 'index.html'),
      path.join(repoPath, 'app', 'index.html'),
    ];

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // continue
      }
    }

    // Fall back to first found html file if any
    return htmlFiles.length > 0 ? htmlFiles[0] : null;
  }

  /**
   * Analyzes the repository and extracts a self-contained previewable HTML page.
   */
  async extractProject(repoPath: string, sessionId: string, workspaceBaseDir: string): Promise<ExtractedProject> {
    const htmlFiles = await this.findFiles(repoPath, ['.html']);
    const cssFiles = await this.findFiles(repoPath, ['.css']);

    // Check package.json if present
    let pkgJson: any = null;
    try {
      const pkgPath = path.join(repoPath, 'package.json');
      const raw = await fs.readFile(pkgPath, 'utf-8');
      pkgJson = JSON.parse(raw);
    } catch {
      // No package.json
    }

    const frameworkDetected = this.detectFramework(htmlFiles.concat(cssFiles), pkgJson);
    const entryHtmlPath = await this.locateEntryHtml(repoPath, htmlFiles);

    let rawHtml = '';
    let isFrameworkShell = false;

    if (entryHtmlPath) {
      const candidateHtml = await fs.readFile(entryHtmlPath, 'utf-8');
      // Detect if this is a bare Vite/CRA/framework shell (just a <div id="root"> + module script)
      // These can't render in a sandboxed iframe — synthesize a real preview instead
      const isViteShell = /type=["']module["']/.test(candidateHtml) && /<div[^>]+id=["']root["']/.test(candidateHtml);
      const isCRAShell = /<div[^>]+id=["']root["'][^>]*>\s*<\/div>/.test(candidateHtml) && !/<nav|<header|<main|<section|<article/i.test(candidateHtml);
      isFrameworkShell = isViteShell || isCRAShell;

      if (isFrameworkShell) {
        // Synthesize a rich preview from source JSX/TSX/Vue files instead
        rawHtml = await this.synthesizePreviewFromSource(repoPath, pkgJson, frameworkDetected);
      } else {
        rawHtml = candidateHtml;
      }
    } else {
      // If no raw html exists (e.g. pure React/Next/Vue source code), create a preview representation
      rawHtml = await this.synthesizePreviewFromSource(repoPath, pkgJson, frameworkDetected);
      isFrameworkShell = true;
    }

    // Load HTML into Cheerio
    const $ = cheerio.load(rawHtml);
    const pageTitle = $('title').text() || pkgJson?.name || 'Project Preview';

    // Ingest CSS files and embed them inline so the preview is 100% self-contained in iframe
    const cssContents: string[] = [];
    for (const cssFile of cssFiles.slice(0, 5)) { // take top CSS stylesheets
      try {
        const content = await fs.readFile(cssFile, 'utf-8');
        cssContents.push(content);
        $('head').append(`<style data-origin="${path.basename(cssFile)}">\n${content}\n</style>`);
      } catch {
        // Ignore read error
      }
    }

    // Ensure responsive viewport meta tag exists
    if ($('meta[name="viewport"]').length === 0) {
      $('head').prepend('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    }

    const finalOriginalHtml = $.html();

    // Save original.html in session preview folder
    const previewDir = path.join(workspaceBaseDir, sessionId, 'preview');
    await fs.mkdir(previewDir, { recursive: true });
    await fs.writeFile(path.join(previewDir, 'original.html'), finalOriginalHtml, 'utf-8');

    return {
      entryHtmlPath: entryHtmlPath || path.join(repoPath, 'index.html'),
      originalHtml: finalOriginalHtml,
      cssContents,
      pageTitle,
      frameworkDetected,
    };
  }

  /**
   * Synthesizes an HTML preview when the repo only has JSX/TSX/Vue source files without a built bundle.
   */
  private async synthesizePreviewFromSource(repoPath: string, pkgJson: any, framework: string): Promise<string> {
    const rawTitle = pkgJson?.name ? pkgJson.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Application Preview';
    const description = pkgJson?.description || 'Interactive web application extracted from repository source code.';

    // Collect all JSX/TSX/Vue/JS component files, prioritizing entry/hero components first
    const rawJsFiles = await this.findFiles(repoPath, ['.tsx', '.jsx', '.vue', '.js']);
    const jsFiles = rawJsFiles.sort((a, b) => {
      const aName = path.basename(a).toLowerCase();
      const bName = path.basename(b).toLowerCase();
      const getPriority = (n: string) => {
        if (/hero|banner/i.test(n)) return 1;
        if (/home|landing/i.test(n)) return 2;
        if (/app|index|main/i.test(n)) return 3;
        if (/feature|budget|dashboard/i.test(n)) return 4;
        if (/about|footer/i.test(n)) return 9;
        return 5;
      };
      return getPriority(aName) - getPriority(bName);
    });
    
    // Extract headings, buttons, links, and paragraphs across components
    const headings: string[] = [];
    const paragraphs: string[] = [];
    const buttons: string[] = [];
    const navLinks: string[] = [];
    const inputs: string[] = [];
    const features: { title: string; desc: string }[] = [];
    let aboutSnippet = '';

    for (const file of jsFiles) {
      try {
        const text = await fs.readFile(file, 'utf-8');
        const fileName = path.basename(file).toLowerCase();
        
        // Extract headings (prioritizing h1 and h2 from hero/home)
        const hMatches = text.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi);
        for (const m of hMatches) {
          let val = m[2].replace(/\{[\s\S]*?\}/g, '').replace(/<[^>]+>/g, '').trim();
          if (val && val.length > 2 && !val.includes('{') && !headings.includes(val)) {
            // Don't let "About Me" override the main hero heading
            if (/about/i.test(val) && headings.length > 0) continue;
            headings.push(val);
          }
        }

        // Extract paragraphs (ignore copyright and about text for main hero description)
        const pMatches = text.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        for (const m of pMatches) {
          let val = m[1].replace(/\{[\s\S]*?\}/g, '').replace(/<[^>]+>/g, '').trim();
          if (val && val.length > 15 && !val.includes('©') && !val.includes('{') && !paragraphs.includes(val)) {
            if (/about|intro/i.test(fileName) && paragraphs.length > 0) continue;
            paragraphs.push(val);
          }
        }

        // Extract clean buttons (strictly filtering out any JS expressions or leaked syntax)
        const bMatches = text.matchAll(/<button[\s\S]*?>([\s\S]*?)<\/button>/gi);
        for (const m of bMatches) {
          let val = m[1].replace(/\{[\s\S]*?\}/g, '').replace(/<[^>]+>/g, '').replace(/[<>{}]/g, '').trim();
          // Filter out JS code leaks like setActiveTab, functions, arrows, semicolons, brackets
          if (
            val &&
            val.length >= 2 &&
            val.length <= 35 &&
            !val.includes('=>') &&
            !val.includes('(') &&
            !val.includes(')') &&
            !val.includes(';') &&
            !val.includes('set') &&
            !val.includes('>') &&
            !buttons.includes(val)
          ) {
            buttons.push(val);
          }
        }

        // Extract nav links
        const aMatches = text.matchAll(/<(?:a|Link)[^>]*>([^<{]+)<\/(?:a|Link)>/gi);
        for (const m of aMatches) {
          const val = m[1].trim();
          if (val && val.length > 1 && val.length < 25 && !val.includes('http') && !navLinks.includes(val)) {
            navLinks.push(val);
          }
        }

        // Look for About section
        if (/about/i.test(fileName)) {
          const p = text.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          if (p && p[1]) {
            aboutSnippet = p[1].replace(/\{[\s\S]*?\}/g, '').replace(/<[^>]+>/g, '').trim();
          }
        }

        // Look for Features
        if (/feature/i.test(fileName)) {
          const h3List = [...text.matchAll(/<h3[^>]*>([^<{]+)<\/h3>/gi)].map(m => m[1].trim());
          const pList = [...text.matchAll(/<p[^>]*>([^<{]+)<\/p>/gi)].map(m => m[1].trim());
          for (let i = 0; i < h3List.length; i++) {
            if (h3List[i] && pList[i]) {
              features.push({ title: h3List[i], desc: pList[i] });
            }
          }
        }

        // Look for input fields / interactive controls
        const inputMatches = text.matchAll(/<input[^>]+(?:placeholder|name|aria-label)=["']([^"']+)["']/gi);
        for (const im of inputMatches) {
          const val = im[1].trim();
          if (val && !inputs.includes(val) && inputs.length < 6) {
            inputs.push(val);
          }
        }
      } catch {
        // continue
      }
    }

    const mainTitle = headings.find(h => !/about/i.test(h)) || headings[0] || rawTitle;
    const heroDesc = paragraphs.find(p => !/hi,|i am|about/i.test(p)) || paragraphs[0] || description;
    const primaryBtn = buttons[0] || 'Get Started';
    const secondaryBtn = buttons[1] || 'Learn More';
    const displayNav = navLinks.slice(0, 4);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${mainTitle}</title>
  <style>
    :root {
      --bg-page: #ffffff;
      --bg-card: #f8fafc;
      --text-main: #0f172a;
      --text-muted: #475569;
      --brand: #2563eb;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg-page);
      color: var(--text-main);
      line-height: 1.6;
      padding: 0;
      margin: 0;
    }
    header {
      width: 100%;
      padding: 1.25rem 2rem;
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .brand { font-size: 1.25rem; font-weight: 800; color: #0f172a; }
    .nav-list { display: flex; gap: 1.5rem; list-style: none; font-weight: 600; font-size: 0.95rem; }
    .nav-list a { color: #475569; text-decoration: none; }
    .nav-list a:hover { color: #0f172a; }
    .hero {
      padding: 4rem 2rem;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
      border-bottom: 1px solid var(--border);
      text-align: center;
    }
    .hero-container { max-width: 800px; margin: 0 auto; }
    .badge {
      display: inline-block;
      padding: 0.35rem 0.85rem;
      background: #e0e7ff;
      color: #3730a3;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
    }
    h1 { font-size: 2.75rem; font-weight: 800; margin-bottom: 1rem; line-height: 1.2; color: #0f172a; }
    p.subtitle { font-size: 1.2rem; color: #475569; margin-bottom: 2rem; }
    .cta-group { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 2.5rem; }
    .btn-main {
      padding: 0.85rem 1.75rem;
      background: #0f172a;
      color: #ffffff;
      border-radius: 10px;
      font-weight: 600;
      text-decoration: none;
      display: inline-block;
      border: none;
      cursor: pointer;
    }
    .btn-sub {
      padding: 0.85rem 1.75rem;
      background: #ffffff;
      color: #0f172a;
      border: 1px solid var(--border);
      border-radius: 10px;
      font-weight: 600;
      text-decoration: none;
      display: inline-block;
      cursor: pointer;
    }
    .features-section { max-width: 1100px; margin: 3rem auto; padding: 0 1.5rem; }
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
    .feature-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.75rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }
    .feature-card h3 { font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem; color: #1e293b; }
    .feature-card p { font-size: 0.95rem; color: #64748b; }
    .about-section { max-width: 800px; margin: 3rem auto; padding: 2rem; background: #f8fafc; border-radius: 16px; border: 1px solid var(--border); }
    footer { padding: 3rem 2rem; background: #ffffff; border-top: 1px solid var(--border); text-align: center; color: #94a3b8; font-size: 0.9rem; }
  </style>
</head>
<body>
  <header>
    <div class="brand">${rawTitle}</div>
    <ul class="nav-list">
      ${displayNav.length > 0 ? displayNav.map(n => `<li><a href="#">${n}</a></li>`).join('') : `<li><a href="#">Home</a></li><li><a href="#">Features</a></li><li><a href="#">Docs</a></li>`}
    </ul>
  </header>

  <main class="hero">
    <div class="hero-container">
      <span class="badge">${framework}</span>
      <h1>${mainTitle}</h1>
      <p class="subtitle">${heroDesc}</p>
      <div class="cta-group">
        <button class="btn-main">${primaryBtn}</button>
        <button class="btn-sub">${secondaryBtn}</button>
      </div>
    </div>
  </main>

  ${inputs.length > 0 ? `
  <section style="max-width:800px; margin:2.5rem auto; padding:2rem; background:#f8fafc; border-radius:16px; border:1px solid var(--border);">
    <h3 style="font-size:1.25rem; font-weight:700; margin-bottom:1.25rem; color:#0f172a;">Application Interface</h3>
    <div style="display:flex; flex-direction:column; gap:1rem;">
      ${inputs.map(inp => `
        <div>
          <label style="display:block; font-size:0.85rem; font-weight:600; color:#475569; margin-bottom:0.35rem;">${inp}</label>
          <input type="text" placeholder="${inp}" style="width:100%; padding:0.75rem 1rem; border-radius:8px; border:1px solid #cbd5e1; font-size:0.95rem;" />
        </div>
      `).join('')}
      <button class="btn-main" style="align-self:flex-start; margin-top:0.5rem;">${primaryBtn}</button>
    </div>
  </section>` : ''}

  ${features.length > 0 ? `
  <section class="features-section">
    <h2 style="font-size:2rem; font-weight:800; margin-bottom:1.5rem; text-align:center;">Key Features</h2>
    <div class="features-grid">
      ${features.map(f => `
        <div class="feature-card">
          <h3>${f.title}</h3>
          <p>${f.desc}</p>
        </div>
      `).join('')}
    </div>
  </section>` : ''}

  ${aboutSnippet ? `
  <section class="about-section">
    <h3 style="font-size:1.4rem; font-weight:700; margin-bottom:0.75rem;">About</h3>
    <p style="color:#475569; font-size:1.05rem;">${aboutSnippet}</p>
  </section>` : ''}

  <footer>
    <p>&copy; ${new Date().getFullYear()} ${rawTitle}. All rights reserved.</p>
  </footer>
</body>
</html>`;
  }
}


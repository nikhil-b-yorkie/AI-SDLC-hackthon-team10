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
    if (entryHtmlPath) {
      rawHtml = await fs.readFile(entryHtmlPath, 'utf-8');
    } else {
      // If no raw html exists (e.g. pure React/Next/Vue source code), create a preview representation
      rawHtml = await this.synthesizePreviewFromSource(repoPath, pkgJson, frameworkDetected);
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
    const title = pkgJson?.name || 'Application Preview';
    const description = pkgJson?.description || 'Extracted from repository source code.';

    // Look for App or Home component file
    const jsFiles = await this.findFiles(repoPath, ['.tsx', '.jsx', '.vue', '.js']);
    const primaryFile = jsFiles.find(f => /App|Home|Index|page/i.test(path.basename(f))) || jsFiles[0];
    let componentSnippet = '';
    if (primaryFile) {
      try {
        componentSnippet = (await fs.readFile(primaryFile, 'utf-8')).slice(0, 1000);
      } catch {
        // continue
      }
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --bg-color: #f8fafc;
      --text-color: #0f172a;
      --primary: #2563eb;
      --card-bg: #ffffff;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      margin: 0;
      padding: 2rem;
      line-height: 1.5;
    }
    .header {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      background: #e0e7ff;
      color: #3730a3;
      margin-bottom: 0.75rem;
    }
    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.875rem;
    }
    p {
      color: #64748b;
      margin: 0;
    }
    .main-content {
      background: var(--card-bg);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    pre {
      background: #1e293b;
      color: #f1f5f9;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.85rem;
    }
    .btn {
      background: var(--primary);
      color: white;
      padding: 0.6rem 1.25rem;
      border: none;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">${framework}</span>
    <h1>${title}</h1>
    <p>${description}</p>
  </div>
  <div class="main-content">
    <h2>Primary Screen View</h2>
    <p>Component Structure extracted from source files:</p>
    ${componentSnippet ? `<pre><code>${componentSnippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>` : '<p>No preview source found.</p>'}
    <button class="btn">Explore Application</button>
  </div>
</body>
</html>`;
  }
}


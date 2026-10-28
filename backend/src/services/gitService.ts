import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CloneOptions } from '../types/index.js';

export class GitService {
  private baseWorkspaceDir: string;

  constructor(workspaceDir?: string) {
    this.baseWorkspaceDir = workspaceDir || path.resolve(process.cwd(), '../workspaces');
  }

  /**
   * Sanitizes a git clone URL by injecting a PAT securely if provided.
   */
  private formatCloneUrl(repoUrl: string, pat?: string): { safeUrl: string; maskedUrl: string } {
    let cleanUrl = repoUrl.trim();

    // Check if it's a local filesystem path for offline testing / hackathon demos
    if (cleanUrl.startsWith('/') || cleanUrl.startsWith('./') || cleanUrl.startsWith('../') || cleanUrl.startsWith('file://')) {
      const resolvedPath = cleanUrl.startsWith('file://') ? cleanUrl.slice(7) : path.resolve(cleanUrl);
      return { safeUrl: resolvedPath, maskedUrl: resolvedPath };
    }

    if (!cleanUrl.endsWith('.git') && !cleanUrl.includes('?')) {
      cleanUrl += '.git';
    }

    if (!pat || pat.trim() === '') {
      return { safeUrl: cleanUrl, maskedUrl: cleanUrl };
    }

    const token = encodeURIComponent(pat.trim());
    try {
      const urlObj = new URL(cleanUrl);
      urlObj.username = 'x-access-token';
      urlObj.password = token;
      const safeUrl = urlObj.toString();

      urlObj.password = '***PAT***';
      const maskedUrl = urlObj.toString();

      return { safeUrl, maskedUrl };
    } catch {
      // If URL parsing fails, attempt regex replacement
      if (cleanUrl.startsWith('https://')) {
        const afterHttps = cleanUrl.slice('https://'.length);
        return {
          safeUrl: `https://x-access-token:${token}@${afterHttps}`,
          maskedUrl: `https://x-access-token:***PAT***@${afterHttps}`,
        };
      }
      return { safeUrl: cleanUrl, maskedUrl: cleanUrl };
    }
  }

  /**
   * Clones a repository into a unique workspace directory.
   */
  async cloneRepository(
    sessionId: string,
    options: CloneOptions,
    onProgress?: (msg: string) => void
  ): Promise<{ repoPath: string; maskedUrl: string }> {
    const sessionDir = path.join(this.baseWorkspaceDir, sessionId);
    const repoPath = path.join(sessionDir, 'repo');

    // Ensure session directory exists and is clean
    await fs.mkdir(sessionDir, { recursive: true });
    try {
      await fs.rm(repoPath, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }

    const { safeUrl, maskedUrl } = this.formatCloneUrl(options.repoUrl, options.pat);
    onProgress?.(`Starting shallow clone of ${maskedUrl}...`);

    const isLocal = safeUrl.startsWith('/') || safeUrl.startsWith('file://');
    const args = ['clone'];
    if (!isLocal) {
      args.push('--depth', '1');
    }
    if (options.branch) {
      args.push('--branch', options.branch);
    }
    args.push(safeUrl, repoPath);

    return new Promise((resolve, reject) => {
      const child = spawn('git', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0', // Never prompt for terminal input
        },
      });

      let stderrOutput = '';

      child.stdout.on('data', (data) => {
        const text = data.toString();
        onProgress?.(text.trim());
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        // Mask token from stderr if present
        const sanitized = text.replace(new RegExp(options.pat || '___never___', 'g'), '***PAT***');
        stderrOutput += sanitized;
        onProgress?.(sanitized.trim());
      });

      child.on('close', (code) => {
        if (code === 0) {
          onProgress?.('Repository cloned successfully.');
          resolve({ repoPath, maskedUrl });
        } else {
          const sanitizedError = stderrOutput.replace(new RegExp(options.pat || '___never___', 'g'), '***PAT***');
          reject(new Error(`Git clone failed with code ${code}: ${sanitizedError || 'Unknown error'}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to invoke git process: ${err.message}`));
      });
    });
  }

  /**
   * Remove workspace directory after session completion if needed.
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const sessionDir = path.join(this.baseWorkspaceDir, sessionId);
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { GitService } from '../services/gitService.js';
import { AnalyzerService } from '../services/analyzerService.js';
import { PreviewService } from '../services/previewService.js';
import { SkillLoader } from '../harness/skillLoader.js';
import { AgentRunner } from '../harness/agentRunner.js';
import { RedesignEngine } from '../harness/redesignEngine.js';
import { SessionStatus } from '../types/index.js';

export class AuditController {
  private gitService: GitService;
  private analyzerService: AnalyzerService;
  private previewService: PreviewService;
  public skillLoader: SkillLoader;
  private agentRunner: AgentRunner;
  private redesignEngine: RedesignEngine;
  private workspaceBaseDir: string;

  // In-memory session tracking and active SSE listeners
  private sessions = new Map<string, SessionStatus>();
  private sseClients = new Map<string, Response[]>();

  constructor() {
    this.workspaceBaseDir = path.resolve(process.cwd(), '../workspaces');
    this.gitService = new GitService(this.workspaceBaseDir);
    this.analyzerService = new AnalyzerService();
    this.previewService = new PreviewService(this.workspaceBaseDir);
    this.skillLoader = new SkillLoader();
    this.agentRunner = new AgentRunner();
    this.redesignEngine = new RedesignEngine();
  }

  private notifySse(sessionId: string, status: SessionStatus) {
    this.sessions.set(sessionId, status);
    const clients = this.sseClients.get(sessionId) || [];
    const payload = `data: ${JSON.stringify(status)}\n\n`;
    clients.forEach((res) => {
      try {
        res.write(payload);
      } catch {
        // client closed
      }
    });
  }

  /**
   * Start Audit Pipeline:
   * 1. Clone repository (with/without PAT)
   * 2. Analyze project & extract DOM
   * 3. Run UI/UX Audit with agent harness (user's skill)
   * 4. Synthesize improved HTML/CSS with hover annotations
   */
  startAudit = async (req: Request, res: Response): Promise<void> => {
    const { repoUrl, pat, branch, apiKey, apiProvider, model } = req.body;

    if (!repoUrl || typeof repoUrl !== 'string') {
      res.status(400).json({ error: 'Valid repoUrl is required.' });
      return;
    }

    const sessionId = uuidv4();
    const initialStatus: SessionStatus = {
      sessionId,
      status: 'cloning',
      progress: 10,
      message: 'Initializing workspace and cloning repository...',
    };

    this.sessions.set(sessionId, initialStatus);
    res.status(202).json({ sessionId, status: 'started' });

    // Run async background processing pipeline
    (async () => {
      try {
        // Step 1: Clone repo
        this.notifySse(sessionId, {
          sessionId,
          status: 'cloning',
          progress: 20,
          message: 'Cloning GitHub repository (shallow clone)...',
        });

        const { repoPath } = await this.gitService.cloneRepository(
          sessionId,
          { repoUrl, pat, branch },
          (msg) => {
            this.notifySse(sessionId, {
              sessionId,
              status: 'cloning',
              progress: 25,
              message: msg,
            });
          }
        );

        // Step 1.5: Build Project (if package.json exists) for live full-fidelity preview
        try {
          const pkgPath = path.join(repoPath, 'package.json');
          const hasPkg = await fs.access(pkgPath).then(() => true).catch(() => false);
          if (hasPkg) {
            this.notifySse(sessionId, {
              sessionId,
              status: 'analyzing',
              progress: 32,
              message: 'Compiling cloned application bundle for live rendering...',
            });
            const { exec } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const execAsync = promisify(exec);
            await execAsync('npm install --prefer-offline --no-audit', { cwd: repoPath, timeout: 60000 });
            await execAsync('npx vite build --base=./ || npm run build', { cwd: repoPath, timeout: 60000 });
          }
        } catch {
          // If building fails (e.g. non-JS or compile error), seamlessly fallback to synthesized preview
        }

        // Step 2: Extract project DOM & CSS
        this.notifySse(sessionId, {
          sessionId,
          status: 'analyzing',
          progress: 40,
          message: 'Analyzing project structure and extracting primary view...',
        });

        const extracted = await this.analyzerService.extractProject(
          repoPath,
          sessionId,
          this.workspaceBaseDir
        );

        // Step 3: Run Audit with Agent Harness
        this.notifySse(sessionId, {
          sessionId,
          status: 'auditing',
          progress: 60,
          message: 'Running UI/UX Audit with Agent Harness and custom skill...',
        });

        const activeSkill = await this.skillLoader.loadSkill();
        const auditResult = await this.agentRunner.runAudit(
          sessionId,
          repoUrl,
          extracted,
          activeSkill,
          (msg) => {
            this.notifySse(sessionId, {
              sessionId,
              status: 'auditing',
              progress: 75,
              message: msg,
            });
          },
          { apiKey, provider: apiProvider, model }
        );

        // Step 4: Synthesize Improved Pure HTML/CSS Preview with metadata
        this.notifySse(sessionId, {
          sessionId,
          status: 'redesigning',
          progress: 85,
          message: 'Synthesizing modernized pure HTML/CSS layout with hover annotations...',
        });

        await this.redesignEngine.generateImprovedPreview(
          sessionId,
          this.workspaceBaseDir,
          extracted,
          auditResult
        );

        // Completed
        const finalStatus: SessionStatus = {
          sessionId,
          status: 'completed',
          progress: 100,
          message: 'UI/UX Audit and Redesign ready for comparison!',
          result: auditResult,
        };
        this.notifySse(sessionId, finalStatus);
      } catch (err: any) {
        const failedStatus: SessionStatus = {
          sessionId,
          status: 'failed',
          progress: 100,
          message: 'Pipeline encountered an error',
          error: err.message || 'Unknown processing error',
        };
        this.notifySse(sessionId, failedStatus);
      }
    })();
  };

  /**
   * SSE Stream endpoint for real-time progress.
   */
  streamProgress = (req: Request, res: Response): void => {
    const sessionId = (req.params.sessionId as string) || '';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!this.sseClients.has(sessionId)) {
      this.sseClients.set(sessionId, []);
    }
    this.sseClients.get(sessionId)!.push(res);

    // Send immediate current status
    const current = this.sessions.get(sessionId);
    if (current) {
      res.write(`data: ${JSON.stringify(current)}\n\n`);
    }

    req.on('close', () => {
      const clients = this.sseClients.get(sessionId) || [];
      this.sseClients.set(
        sessionId,
        clients.filter((c) => c !== res)
      );
    });
  };

  /**
   * Status check polling endpoint.
   */
  getStatus = (req: Request, res: Response): void => {
    const sessionId = (req.params.sessionId as string) || '';
    const session = this.sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }
    res.json(session);
  };

  /**
   * Serve Original Preview HTML.
   */
  getOriginalPreview = async (req: Request, res: Response): Promise<void> => {
    const sessionId = (req.params.sessionId as string) || '';
    try {
      const html = await this.previewService.getPreviewHtml(sessionId, 'original');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err: any) {
      res.status(404).send(`<h3>Original Preview Unavailable</h3><p>${err.message}</p>`);
    }
  };

  /**
   * Serve Improved Preview HTML.
   */
  getImprovedPreview = async (req: Request, res: Response): Promise<void> => {
    const sessionId = (req.params.sessionId as string) || '';
    try {
      const html = await this.previewService.getPreviewHtml(sessionId, 'improved');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err: any) {
      res.status(404).send(`<h3>Improved Preview Unavailable</h3><p>${err.message}</p>`);
    }
  };

  /**
   * Get Active Audit Skill.
   */
  getSkill = async (_req: Request, res: Response): Promise<void> => {
    const skill = await this.skillLoader.loadSkill();
    res.json(skill);
  };

  /**
   * Update or Save Custom Audit Skill.
   */
  updateSkill = async (req: Request, res: Response): Promise<void> => {
    const { markdown, saveToDisk } = req.body;
    if (typeof markdown !== 'string') {
      res.status(400).json({ error: 'markdown string is required.' });
      return;
    }

    if (saveToDisk) {
      await this.skillLoader.saveSkillToDisk(markdown);
    } else {
      this.skillLoader.setCustomSkill(markdown);
    }

    const updated = await this.skillLoader.loadSkill();
    res.json({ message: 'Audit skill updated successfully.', skill: updated });
  };
}

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { AuditController } from './controllers/auditController.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const workspacesBaseDir = path.resolve(process.cwd(), '../workspaces');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const auditController = new AuditController();

// API Routes
app.post('/api/audit/start', auditController.startAudit);
app.get('/api/audit/stream/:sessionId', auditController.streamProgress);
app.get('/api/audit/status/:sessionId', auditController.getStatus);

// Static assets for built session dists
app.use('/api/preview/:sessionId/dist', (req, res, next) => {
  const sessionId = req.params.sessionId;
  const distDir = path.join(workspacesBaseDir, sessionId, 'repo', 'dist');
  express.static(distDir)(req, res, next);
});

app.use('/api/preview/:sessionId/assets', (req, res, next) => {
  const sessionId = req.params.sessionId;
  const assetsDir = path.join(workspacesBaseDir, sessionId, 'repo', 'dist', 'assets');
  express.static(assetsDir)(req, res, next);
});

// Fallback for root-relative /assets/ from Vite builds
app.use('/assets', (req, res, next) => {
  try {
    if (fs.existsSync(workspacesBaseDir)) {
      const sessions = fs.readdirSync(workspacesBaseDir);
      for (const s of sessions) {
        const candidate = path.join(workspacesBaseDir, s, 'repo', 'dist', 'assets', req.path.replace(/^\//, ''));
        if (fs.existsSync(candidate)) {
          return res.sendFile(candidate);
        }
      }
    }
  } catch {}
  next();
});

// Preview endpoints
app.get('/api/preview/:sessionId/original', auditController.getOriginalPreview);
app.get('/api/preview/:sessionId/improved', auditController.getImprovedPreview);

// Skill management endpoints
app.get('/api/skill', auditController.getSkill);
app.post('/api/skill', auditController.updateSkill);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'UI/UX Audit Agent Platform' });
});

app.listen(port, () => {
  console.log(`🚀 UI/UX Audit Server listening at http://localhost:${port}`);
});


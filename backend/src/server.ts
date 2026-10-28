import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AuditController } from './controllers/auditController.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const auditController = new AuditController();

// API Routes
app.post('/api/audit/start', auditController.startAudit);
app.get('/api/audit/stream/:sessionId', auditController.streamProgress);
app.get('/api/audit/status/:sessionId', auditController.getStatus);

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


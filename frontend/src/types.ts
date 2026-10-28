export type SeverityLevel = 'high' | 'medium' | 'low';

export type AuditCategory = 
  | 'usability' 
  | 'visual_hierarchy' 
  | 'consistency' 
  | 'accessibility' 
  | 'responsiveness';

export interface AuditFinding {
  id: string;
  category: AuditCategory;
  severity: SeverityLevel;
  title: string;
  selector: string;
  problem: string;
  why_it_matters: string;
  how_to_fix: string;
  improvement_summary: string;
}

export interface CategoryScore {
  score: number;
  reason: string;
}

export interface AuditScorecard {
  overall_score: number;
  usability: CategoryScore;
  visual_hierarchy: CategoryScore;
  consistency: CategoryScore;
  accessibility: CategoryScore;
  responsiveness: CategoryScore;
}

export interface AuditResult {
  sessionId: string;
  repoUrl: string;
  scorecard: AuditScorecard;
  findings: AuditFinding[];
  redesignOverview: string;
  createdAt: string;
}

export interface SessionStatus {
  sessionId: string;
  status: 'idle' | 'cloning' | 'analyzing' | 'auditing' | 'redesigning' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
  result?: AuditResult;
}

export interface HoverAuditInfo {
  auditId: string;
  title: string;
  summary: string;
  category: string;
  severity: string;
  why?: string;
}

export interface AuditSkill {
  name: string;
  description: string;
  rawMarkdown: string;
  source: 'file' | 'custom';
}


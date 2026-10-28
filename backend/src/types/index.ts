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
  diff_before?: string;
  diff_after?: string;
}

export interface CategoryScore {
  score: number; // 0 - 10 (baseline score)
  improved_score?: number; // 0 - 10 (score after redesign)
  reason: string;
}

export interface AuditScorecard {
  overall_score: number; // 0 - 10 (baseline score)
  improved_overall_score?: number; // 0 - 10 (score after redesign)
  score_gain?: number; // point increase (e.g. +3.8)
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
  progress: number; // 0 - 100
  message: string;
  error?: string;
  result?: AuditResult;
}

export interface CloneOptions {
  repoUrl: string;
  pat?: string;
  branch?: string;
}


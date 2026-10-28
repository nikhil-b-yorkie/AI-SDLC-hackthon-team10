import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface AuditSkillConfig {
  name: string;
  description: string;
  rawMarkdown: string;
  source: 'file' | 'custom';
}

export class SkillLoader {
  private defaultSkillPath: string;
  private currentCustomSkill: string | null = null;

  constructor(skillPath?: string) {
    this.defaultSkillPath = skillPath || path.resolve(process.cwd(), '../skills/audit_skill.md');
  }

  /**
   * Loads the active audit skill. Priority:
   * 1. In-memory custom skill (uploaded/edited via UI)
   * 2. File at skills/audit_skill.md
   */
  async loadSkill(): Promise<AuditSkillConfig> {
    if (this.currentCustomSkill) {
      return {
        name: 'Custom User Audit Skill',
        description: 'User-provided UI/UX audit skill instructions',
        rawMarkdown: this.currentCustomSkill,
        source: 'custom',
      };
    }

    try {
      const content = await fs.readFile(this.defaultSkillPath, 'utf-8');
      return {
        name: 'Workspace UI/UX Audit Skill',
        description: 'Loaded from skills/audit_skill.md',
        rawMarkdown: content,
        source: 'file',
      };
    } catch {
      // Fallback if file not found
      return {
        name: 'Default UI/UX Audit Heuristics',
        description: 'Built-in evaluation rubric',
        rawMarkdown: `# UI/UX Audit Skill\n\nEvaluate Usability, Visual Hierarchy, Accessibility, Consistency, and Responsiveness.`,
        source: 'custom',
      };
    }
  }

  /**
   * Allows the user to dynamically inject their custom audit skill via UI/API.
   */
  setCustomSkill(markdown: string): void {
    this.currentCustomSkill = markdown.trim();
  }

  /**
   * Saves updated skill back to disk at skills/audit_skill.md.
   */
  async saveSkillToDisk(markdown: string): Promise<void> {
    await fs.mkdir(path.dirname(this.defaultSkillPath), { recursive: true });
    await fs.writeFile(this.defaultSkillPath, markdown, 'utf-8');
    this.currentCustomSkill = null; // Reset custom to use disk version
  }
}


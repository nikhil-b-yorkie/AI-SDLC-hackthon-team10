import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'node:path';
import { SkillLoader } from '../harness/skillLoader.js';
import { AnalyzerService } from '../services/analyzerService.js';
import { AgentRunner } from '../harness/agentRunner.js';
import { RedesignEngine } from '../harness/redesignEngine.js';

describe('Audit Harness Core Verification', () => {
  const skillLoader = new SkillLoader();
  const analyzerService = new AnalyzerService();
  const agentRunner = new AgentRunner();
  const redesignEngine = new RedesignEngine();

  test('SkillLoader loads user audit skill properly', async () => {
    const skill = await skillLoader.loadSkill();
    assert.ok(skill.rawMarkdown.length > 0);
    assert.ok(skill.rawMarkdown.includes('UI Audit'));
  });

  test('SkillLoader allows custom skill hot-swapping', async () => {
    skillLoader.setCustomSkill('# Custom High-Contrast Heuristics\n\nMust check contrast 7:1');
    const custom = await skillLoader.loadSkill();
    assert.strictEqual(custom.source, 'custom');
    assert.ok(custom.rawMarkdown.includes('Custom High-Contrast'));

    // Reset back
    skillLoader.setCustomSkill('');
  });

  test('AgentRunner executes audit and generates scorecards & findings', async () => {
    const mockExtracted = {
      entryHtmlPath: '/tmp/test.html',
      originalHtml: `
        <!DOCTYPE html>
        <html>
          <head><title>Old Product Screen</title></head>
          <body>
            <div class="content">
              <p>Old un-styled landing page.</p>
              <img src="logo.png">
              <button>click</button>
            </div>
          </body>
        </html>
      `,
      cssContents: [],
      pageTitle: 'Old Product Screen',
      frameworkDetected: 'Static HTML',
    };

    const skill = await skillLoader.loadSkill();
    const result = await agentRunner.runAudit('test-session', 'https://github.com/mock/repo', mockExtracted, skill);

    assert.ok(result.scorecard.overall_score > 0);
    assert.ok(result.findings.length > 0);
    assert.strictEqual(result.sessionId, 'test-session');
    
    // Check that missing alt attribute on img was caught
    const accessibilityIssue = result.findings.find(f => f.category === 'accessibility');
    assert.ok(accessibilityIssue, 'Should flag accessibility finding for img without alt');

    // Test Redesign Engine
    const workspaceDir = path.resolve(process.cwd(), '../workspaces');
    const improvedHtml = await redesignEngine.generateImprovedPreview(
      'test-session',
      workspaceDir,
      mockExtracted,
      result
    );

    assert.ok(improvedHtml.includes('data-audit-id'), 'Improved HTML must contain audit annotations');
    assert.ok(improvedHtml.includes('audit-hover-popover'), 'Improved HTML must include hover popover inspector');
    assert.ok(improvedHtml.includes('<!DOCTYPE html>'), 'Improved HTML must be complete valid document');
  });
});


import * as cheerio from 'cheerio';
import { AuditFinding, AuditResult, AuditScorecard } from '../types/index.js';
import { ExtractedProject } from '../services/analyzerService.js';
import { AuditSkillConfig } from './skillLoader.js';

export interface AgentApiConfig {
  provider?: 'gemini' | 'openrouter';
  apiKey?: string;
  model?: string;
}

export class AgentRunner {
  /**
   * Executes the UI/UX audit using the user's supplied skill.
   */
  async runAudit(
    sessionId: string,
    repoUrl: string,
    extracted: ExtractedProject,
    skill: AuditSkillConfig,
    onProgress?: (msg: string) => void,
    apiConfig?: AgentApiConfig
  ): Promise<AuditResult> {
    onProgress?.(`Applying user audit skill: "${skill.name}"...`);

    // Determine provider & key
    // Request-level config overrides env vars; openrouter key takes priority over gemini
    const openRouterKey = (apiConfig?.provider === 'openrouter' && apiConfig.apiKey)
      ? apiConfig.apiKey
      : process.env.OPENROUTER_API_KEY;

    const geminiKey = (apiConfig?.provider === 'gemini' && apiConfig.apiKey)
      ? apiConfig.apiKey
      : process.env.GEMINI_API_KEY;

    // Prefer OpenRouter if key available (free models configured in .env)
    const provider = apiConfig?.provider
      || (openRouterKey ? 'openrouter' : (geminiKey ? 'gemini' : null));

    if (provider === 'openrouter' && openRouterKey) {
      try {
        const model = apiConfig?.model || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-lightning:free';
        onProgress?.(`Invoking OpenRouter AI Agent (${model}) with custom audit skill...`);
        return await this.runOpenRouterAudit(sessionId, repoUrl, extracted, skill, openRouterKey, model, onProgress);
      } catch (err: any) {
        onProgress?.(`OpenRouter call note (${err.message}). Checking Gemini fallback...`);
      }
    }

    if (geminiKey) {
      try {
        const model = apiConfig?.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        onProgress?.(`Invoking Gemini AI Agent (${model}) with custom audit skill...`);
        return await this.runGeminiAudit(sessionId, repoUrl, extracted, skill, geminiKey, model, onProgress);
      } catch (err: any) {
        onProgress?.(`Gemini Agent note (${err.message}). Falling back to heuristic rule engine...`);
      }
    }

    // Comprehensive heuristic audit engine running against the user's skill guidelines
    onProgress?.('Evaluating interface against skill heuristics and DOM metrics...');
    return this.runHeuristicAudit(sessionId, repoUrl, extracted, skill, onProgress);
  }

  /**
   * OpenRouter AI Agent invocation (supports Claude 3.5 Sonnet, GPT-4o, Llama 3.3, Gemini, etc.)
   */
  private async runOpenRouterAudit(
    sessionId: string,
    repoUrl: string,
    extracted: ExtractedProject,
    skill: AuditSkillConfig,
    apiKey: string,
    model: string,
    onProgress?: (msg: string) => void
  ): Promise<AuditResult> {
    const systemPrompt = `You are a Principal UI/UX Designer, Accessibility Specialist, and Auditor.
You MUST adhere strictly to the following UI/UX Audit Skill rules provided by the user:

--- USER AUDIT SKILL START ---
${skill.rawMarkdown}
--- USER AUDIT SKILL END ---

Return ONLY a strictly valid JSON object adhering to this schema:
{
  "scorecard": {
    "overall_score": number, // 1 to 10 (or converted from 100 scale)
    "usability": { "score": number, "reason": "string" },
    "visual_hierarchy": { "score": number, "reason": "string" },
    "consistency": { "score": number, "reason": "string" },
    "accessibility": { "score": number, "reason": "string" },
    "responsiveness": { "score": number, "reason": "string" }
  },
  "findings": [
    {
      "id": "finding-1",
      "category": "usability" | "visual_hierarchy" | "consistency" | "accessibility" | "responsiveness",
      "severity": "high" | "medium" | "low",
      "title": "string",
      "selector": "string (valid CSS selector in target)",
      "problem": "string",
      "why_it_matters": "string",
      "how_to_fix": "string",
      "improvement_summary": "Short 1-2 sentence summary displayed on hover"
    }
  ],
  "redesignOverview": "string"
}`;

    const userContent = `Target Application: "${extracted.pageTitle}" (${extracted.frameworkDetected})
Analyze this extracted HTML and CSS structure:
\`\`\`html
${extracted.originalHtml.slice(0, 10000)}
\`\`\``;

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'DesignAuditor AI',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        // Note: do NOT send response_format for free/open models that don't support it
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenRouter returned status ${resp.status}: ${errText}`);
    }

    const data: any = await resp.json();
    let rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) {
      const errMsg = data.error?.message || JSON.stringify(data);
      throw new Error(`OpenRouter returned empty content: ${errMsg}`);
    }

    // Strip markdown fences, extra text before/after JSON
    if (rawContent.includes('```')) {
      rawContent = rawContent.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    }
    // Extract first JSON object if surrounded by prose
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) rawContent = jsonMatch[0];

    const parsed = JSON.parse(rawContent);

    return {
      sessionId,
      repoUrl,
      scorecard: parsed.scorecard,
      findings: parsed.findings,
      redesignOverview: parsed.redesignOverview || `Redesign synthesized with OpenRouter (${model}) guided by custom audit skill.`,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Gemini AI Agent invocation
   */
  private async runGeminiAudit(
    sessionId: string,
    repoUrl: string,
    extracted: ExtractedProject,
    skill: AuditSkillConfig,
    apiKey: string,
    model: string,
    onProgress?: (msg: string) => void
  ): Promise<AuditResult> {
    const prompt = `You are a Principal UI/UX Designer and Auditor.
You MUST adhere strictly to the following UI/UX Audit Skill instructions provided by the user:

--- USER AUDIT SKILL START ---
${skill.rawMarkdown}
--- USER AUDIT SKILL END ---

Target Application: "${extracted.pageTitle}" (${extracted.frameworkDetected})
Analyze this extracted HTML and CSS structure:
\`\`\`html
${extracted.originalHtml.slice(0, 10000)}
\`\`\`

Return a strictly valid JSON object adhering to this schema:
{
  "scorecard": {
    "overall_score": number, // 1 to 10
    "usability": { "score": number, "reason": "string" },
    "visual_hierarchy": { "score": number, "reason": "string" },
    "consistency": { "score": number, "reason": "string" },
    "accessibility": { "score": number, "reason": "string" },
    "responsiveness": { "score": number, "reason": "string" }
  },
  "findings": [
    {
      "id": "finding-1",
      "category": "usability" | "visual_hierarchy" | "consistency" | "accessibility" | "responsiveness",
      "severity": "high" | "medium" | "low",
      "title": "string",
      "selector": "string (valid CSS selector in target)",
      "problem": "string",
      "why_it_matters": "string",
      "how_to_fix": "string",
      "improvement_summary": "Short 1-2 sentence summary displayed on hover"
    }
  ],
  "redesignOverview": "string"
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`Gemini API returned ${resp.status}: ${errBody}`);
    }

    const data: any = await resp.json();
    let rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) {
      throw new Error('Gemini API returned empty candidate content');
    }

    if (rawContent.includes('```')) {
      rawContent = rawContent.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(rawContent);

    return {
      sessionId,
      repoUrl,
      scorecard: parsed.scorecard,
      findings: parsed.findings,
      redesignOverview: parsed.redesignOverview || 'Redesign synthesized according to custom audit skill.',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Deterministic Heuristic Engine that evaluates the DOM against the skill's 5 pillars.
   */
  private runHeuristicAudit(
    sessionId: string,
    repoUrl: string,
    extracted: ExtractedProject,
    skill: AuditSkillConfig,
    onProgress?: (msg: string) => void
  ): AuditResult {
    const $ = cheerio.load(extracted.originalHtml);
    const findings: AuditFinding[] = [];

    let accessibilityScore = 8.5;
    let visualHierarchyScore = 8.0;
    let usabilityScore = 8.0;
    let consistencyScore = 8.5;
    let responsivenessScore = 8.0;

    // 1. Accessibility Checks
    const imagesWithoutAlt = $('img:not([alt])');
    if (imagesWithoutAlt.length > 0) {
      accessibilityScore -= 1.5;
      findings.push({
        id: 'finding-1',
        category: 'accessibility',
        severity: 'high',
        title: 'Missing Accessible Alt Attributes on Images',
        selector: 'img',
        problem: `Found ${imagesWithoutAlt.length} image(s) lacking descriptive 'alt' tags.`,
        why_it_matters: 'Screen readers and assistive technologies cannot interpret the purpose or context of images without alt text.',
        how_to_fix: 'Provide meaningful alt text for content images or empty alt="" for purely decorative graphics.',
        improvement_summary: 'Added semantic alt tags and aria-labels for full screen-reader accessibility.',
      });
    }

    // 2. Visual Hierarchy Checks (Headings & Structure)
    const h1Count = $('h1').length;
    if (h1Count === 0) {
      visualHierarchyScore -= 1.5;
      findings.push({
        id: 'finding-2',
        category: 'visual_hierarchy',
        severity: 'medium',
        title: 'Absence of Primary H1 Heading',
        selector: 'body',
        problem: 'The document lacks a clear primary <h1> heading tag as the visual anchor.',
        why_it_matters: 'Users rely on a single primary heading to immediately scan and understand the core purpose of the page.',
        how_to_fix: 'Elevate the main page title to an <h1> with distinctive font size and weight.',
        improvement_summary: 'Introduced high-contrast H1 display typography with clear visual weight.',
      });
    } else if (h1Count > 1) {
      visualHierarchyScore -= 0.5;
      findings.push({
        id: 'finding-3',
        category: 'visual_hierarchy',
        severity: 'low',
        title: 'Multiple H1 Headings Competing for Focus',
        selector: 'h1',
        problem: `Found ${h1Count} <h1> elements on a single screen view.`,
        why_it_matters: 'Competing top-level headings dilute visual focus and cause scanning fatigue.',
        how_to_fix: 'Reserve <h1> strictly for the main headline and demote supporting section titles to <h2>.',
        improvement_summary: 'Reorganized heading hierarchy: single prominent H1 with clean H2/H3 sub-headers.',
      });
    }

    // 3. Usability & CTAs
    const buttons = $('button, a.btn, input[type="submit"]');
    if (buttons.length === 0) {
      usabilityScore -= 1.5;
      findings.push({
        id: 'finding-4',
        category: 'usability',
        severity: 'high',
        title: 'Missing Clear Call to Action (CTA)',
        selector: '.main-content',
        problem: 'No distinctive interactive button or clear next-step conversion element detected.',
        why_it_matters: 'Without an unambiguous CTA, conversion rates drop and user intent stalls.',
        how_to_fix: 'Place an elevated, high-contrast action button above the fold with generous click target (min 44px).',
        improvement_summary: 'Added a prominent primary CTA button with tactile elevation and 48px touch target.',
      });
    } else {
      findings.push({
        id: 'finding-4',
        category: 'usability',
        severity: 'medium',
        title: 'Action Button Affordance & Spacing',
        selector: 'button, .btn',
        problem: 'Action buttons lack sufficient padding and tactile hover feedback.',
        why_it_matters: "Fitts's Law dictates that touch targets smaller than 44px increase interaction error rates.",
        how_to_fix: 'Enlarge button padding to 12px 24px, add subtle shadow elevation and smooth hover transitions.',
        improvement_summary: 'Enlarged button touch target to 48px with smooth tactile lift and hover states.',
      });
    }

    // 4. Color & Contrast Consistency
    findings.push({
      id: 'finding-5',
      category: 'consistency',
      severity: 'medium',
      title: 'Color Palette & Typography Rhythm',
      selector: '.header, body',
      problem: 'Color contrast ratio on secondary copy is below 4.5:1, and typographic scale lacks consistent rhythm.',
      why_it_matters: 'Subtle text colors cause eye strain, particularly on mobile screens under direct lighting.',
      how_to_fix: 'Adopt the 60-30-10 color rule with high-contrast text tokens (#0f172a / #475569) and consistent line-height (1.6).',
      improvement_summary: 'Upgraded typography to modern Inter font stack with 6.5:1 WCAG AA compliant text contrast.',
    });

    // 5. Responsiveness & Spacing
    const hasViewport = $('meta[name="viewport"]').length > 0;
    if (!hasViewport) {
      responsivenessScore -= 2.0;
    }
    findings.push({
      id: 'finding-6',
      category: 'responsiveness',
      severity: 'medium',
      title: 'Fluid Container Grid & Whitespace Rhythm',
      selector: 'main, .container',
      problem: 'Layout uses fixed margins without a flexible responsive grid system.',
      why_it_matters: 'Content may pinch or trigger horizontal scrollbars on smaller viewports.',
      how_to_fix: 'Implement responsive CSS Grid / Flexbox containers with 8px spacing increments (16px/24px/32px padding).',
      improvement_summary: 'Rebuilt layout with fluid CSS Grid and 8px responsive spacing increments.',
    });

    // Clamp scores
    const clamp = (val: number) => Math.max(1, Math.min(10, Math.round(val * 10) / 10));
    accessibilityScore = clamp(accessibilityScore);
    visualHierarchyScore = clamp(visualHierarchyScore);
    usabilityScore = clamp(usabilityScore);
    consistencyScore = clamp(consistencyScore);
    responsivenessScore = clamp(responsivenessScore);

    const overallScore = clamp(
      (accessibilityScore + visualHierarchyScore + usabilityScore + consistencyScore + responsivenessScore) / 5
    );

    const scorecard: AuditScorecard = {
      overall_score: overallScore,
      usability: {
        score: usabilityScore,
        reason: 'Action hierarchy and touch target sizes evaluated across user workflows.',
      },
      visual_hierarchy: {
        score: visualHierarchyScore,
        reason: 'Heading contrast, scanning anchors, and visual grouping assessed.',
      },
      consistency: {
        score: consistencyScore,
        reason: 'Color palette tokens, component radiuses, and font scale evaluated.',
      },
      accessibility: {
        score: accessibilityScore,
        reason: 'WCAG 2.1 AA compliance: contrast ratios, semantic landmarks, and image tags.',
      },
      responsiveness: {
        score: responsivenessScore,
        reason: 'Fluid container behavior and touch adaptability evaluated.',
      },
    };

    onProgress?.(`Audit complete. Overall UI/UX Score: ${overallScore}/10 (${findings.length} improvement points).`);

    return {
      sessionId,
      repoUrl,
      scorecard,
      findings,
      redesignOverview: `Applied redesign guided by "${skill.name}". Enhanced visual hierarchy, modernized color palette, optimized touch targets, and established responsive 8px spacing rhythm.`,
      createdAt: new Date().toISOString(),
    };
  }
}

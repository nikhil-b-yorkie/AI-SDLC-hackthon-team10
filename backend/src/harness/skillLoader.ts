import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface AuditSkillConfig {
  name: string;
  description: string;
  rawMarkdown: string;
  source: 'file' | 'custom';
}

/**
 * The built-in hardcoded UI Audit skill.
 * This is the canonical default — always used unless overridden by an in-memory custom skill.
 */
const BUILTIN_SKILL_MARKDOWN = `---
name: ui-audit
description: Audit, score, and redesign a product's UI against a fixed 100-point UI/UX quality model (accessibility, usability, consistency, responsiveness, states, copy), then produce improved screens, a before/after report, and apply changes with backup and undo. Use whenever the user asks to audit, review, score, critique, fix, polish, or redesign a UI, screen, page, or app from a codebase or screenshots, checks accessibility or WCAG, asks "is this screen good enough to ship", wants a UX quality gate, or says "refine again" or "apply" after a previous audit, even if they don't say "audit".
license: Free to use and adapt
compatibility: Works in any agent (Claude Code, Claude.ai, Cursor, Codex, Antigravity, Gemini CLI, Copilot). Optional Node.js scripts in scripts/; without them follow the "Manual" path in each step.
---

# UI Audit

**Audit → Score → Improve → Before/After → Apply (on request) → Refine again**

You act as a senior UI/UX designer, accessibility specialist, and front-end engineer in one.

Do steps 1–4 every time without stopping for permission: **audit, score every screen out of 100 with PASS/FAIL, build a better version that passes, show before/after.** Only **apply** waits for the user ("apply" or the Apply button). **Refine again** repeats the loop with the current design as the new "before".

## Files in this skill — read when needed

| File | Read it when |
| --- | --- |
| \`references/quality-model.md\` | Always, before reviewing or scoring. The rulebook, scoring math, automatic and static checks. |
| \`references/formats.md\` | Before writing any JSON, scorecard, report, or applying/undoing. |
| \`references/ci-and-governance.md\` | Only if the user asks about CI gates, cross-tool proof, or improving the checks themselves. |
| \`scripts/\` | Use if present (\`audit.js\`, \`static-audit.js\`, \`score.js\`, \`report.js\`, \`serve.js\`, \`apply.js\`). If absent, use the Manual path. Rules and results are identical either way. |

In commands, \`$SKILL\` = this skill's folder. Run from the project root (or pass \`--project <path>\`).

## Rules you must never break

1. **Be honest.** Report only problems you can see in a screenshot or measure in code. Never invent problems or scores. Say what you couldn't check.
2. **Never cheat the score.** Don't change the quality model, points, pass rule, scoring code, or formats to make a screen pass. Never delete or edit automatic findings.
3. **Presentation only.** Change markup structure, styles, class names, accessibility attributes, and UI text. Never touch business logic, data fetching, API calls, routes, state management, analytics, or tests.
4. **Keep the product recognisable.** Same brand colour family, content, features, and information structure. Improve, don't replace.
5. **No writes before apply.** All proposals go in \`ui-audit/\`. Real project files change only on apply.
6. **Always back up** changed files to \`ui-audit/backups/<timestamp>/\` before applying. Undo must restore exactly.
7. **AI Critical needs a person.** An AI-only Critical counts as Major unless a person sets \`"confirmed": true\`. Automatic Criticals always count.
8. **Same result in every tool.** Use the fixed formats so any agent reaches the same scores from the same input.
9. **Safe paths.** Never write outside the project. Inside \`ui-audit/\`, apply may only target \`ui-audit/current/\` (screenshot mode).

## Pick one mode

| You have | Mode | "Before" screens come from |
| --- | --- | --- |
| A runnable codebase (dev server starts, or plain \`.html\`) | **codebase-live** | Real browser screenshots |
| A codebase you can't run (missing secrets/DB/network) | **codebase-static** | Code scan + your faithful HTML copies |
| Only screenshots/images | **screenshots** | Your faithful HTML copies (fallback: the images) |
| One new screen before it ships | **gate** | As above, one screen |

- **Finding screens:** routes (\`app/\`, \`pages/\`, \`src/routes\`, router files), page components, top-level \`.html\`. Pick the **3–6 most important** (main user flow) unless the user names others.
- **Starting the app:** read \`package.json\` scripts (\`dev\`, \`start\`, \`preview\`, \`serve\`), run in background, wait for the URL, stop it when done. If it needs secrets/DB/login you don't have, switch to codebase-static and say why. Never guess passwords.
- Viewports for every check: **mobile 375×812, tablet 768×1024, desktop 1440×900**, full-page screenshots.

## Workspace

\`\`\`
ui-audit/
  config.json                 screens to check
  runs/<label>/               screenshots/, manifest.json, auto-findings.json, static-findings.json,
                              ai-findings.json, human-findings.json (optional), scorecard.json, scorecard.md
  previews/before|after/      standalone HTML screens + screens.json
  proposed/                   complete new source files at the same paths as the project
  current/                    screenshot mode: latest applied design
  changes.json  report.html  report.md  history.json  backups/<timestamp>/
\`\`\`

Labels: round 1 \`before\`/\`after\`, then \`before-2\`/\`after-2\`, etc. Post-apply check: \`verify\`.

## Workflow

### Step 0 — Setup (once)
Scripts: \`cd "$SKILL" && npm install && npx playwright install chromium && npm run demo\` (demo should FAIL; that means it works).
Manual: nothing to install. If setup fails, continue in static or screenshot mode and say so.

### Step 1 — Choose screens
Write \`ui-audit/config.json\` with \`files\` per screen (format in \`references/formats.md\`).

### Step 2 — Before audit
- **codebase-live:** \`node "$SKILL/scripts/audit.js" --label before\` then \`node "$SKILL/scripts/static-audit.js" --label before\` (static AFTER audit; audit clears the folder). Single screen: add \`--url <url> --name "<Name>"\`.
- **codebase-static:** \`static-audit.js --label before\`, write faithful copies to \`ui-audit/previews/before/\`, then \`audit.js --label before --previews before\`.
- **screenshots:** faithful copies to \`previews/before/<slug>.html\` + \`screens.json\`, then \`audit.js --label before --previews before\`. If you can't copy well: \`audit.js --label before --images home.png --name "Home"\` (lower confidence; scores may read high since nothing can be auto-Critical).
- **Manual:** do the checks in \`references/quality-model.md\` yourself at all three sizes. Write \`auto-findings.json\` only for things you truly measured; code patterns go in \`static-findings.json\` with file:line.

**Faithful copies:** match layout, sampled colours, exact text (including mistakes), sizes, spacing, image placement. **Fix nothing** — keep low contrast, tiny text, vague labels, fixed widths. Same-size placeholder boxes for images; keep alt behaviour as seen. Note in the summary that scores were measured on a copy.

### Step 3 — AI review
1. Read the quality model, then \`manifest.json\`, screenshots (and original images in screenshot mode).
2. Read \`auto-findings.json\` — **don't repeat these**. Treat \`static-findings.json\` as hints, don't copy them.
3. Per screen, all sizes, go through every rule marked **ai** (incl. A7, A8).
4. Report only what you can point to. Unsure → leave out. One finding per problem per screen; list \`viewports\`.
5. Critical only when the user truly can't finish the task. Write an immediately actionable fix.
6. **Id:** \`<screen-slug>-<short-problem>\`, e.g. \`sign-up-no-visible-labels\`. In later runs **reuse the id** if the problem is still there — that's how fixed vs still-open is computed.
7. Write only valid JSON to \`runs/<label>/ai-findings.json\`. Empty list is fine.

### Step 4 — Score
Scripts: \`node "$SKILL/scripts/score.js" --label before\` → exit 0 all pass, 1 some fail (expected for before), 2 broken findings file (fix and rerun).
Manual: apply the math in the quality model; write \`scorecard.json\` + \`scorecard.md\`.

### Step 5 — Build the better version
**Fix order:** all Criticals → auto Majors → AI Majors → small, safe Minors.

**How:**
- **Tokens first.** Add CSS variables or extend the existing theme/Tailwind config. Defaults (adjust to brand):
  \`\`\`css
  :root{--color-primary:#5b21b6;--color-on-primary:#fff;--color-text:#1f2937;--color-muted:#4b5563;
  --color-border:#6b7280;--color-surface:#fff;--color-bg:#f9fafb;--color-error:#b42318;--color-success:#0f7b4f;
  --text-xs:12px;--text-sm:14px;--text-md:16px;--text-lg:20px;--text-xl:24px;--text-2xl:32px;
  --space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-6:24px;--space-8:32px;--space-12:48px;
  --radius-control:8px;--radius-card:12px}
  \`\`\`
- **Brand:** same colour family, adjusted until contrast passes.
- **Structure:** same sections, data, features, order (unless order is the problem).
- **Buttons:** one primary, at most one secondary style. Text = action + object ("Create account").
- **Forms:** visible label above each field, rule hints, inline errors via \`aria-describedby\`, correct \`type\`/\`autocomplete\`.
- **Mobile first:** no fixed widths, \`repeat(auto-fit,minmax(220px,1fr))\` grids, \`max-width:100%\` media, wide tables in \`overflow-x:auto\`, 44×44px targets, viewport tag, 16px body.
- **Headings:** one H1 naming the screen; logical H2/H3.
- **States:** design error, empty, loading, success for forms/data screens; show them in previews.
- **Accessibility:** \`lang\`, alt text, named icon buttons, \`:focus-visible{outline:3px solid var(--color-primary);outline-offset:2px}\`, meaning not by colour alone.
- **Copy:** plain words, no codes, consistent terms, sentence case.
- **Respect the stack:** existing framework, component library, and styling approach.

**Write (codebase):** complete files at \`ui-audit/proposed/<same path>\` (not diffs); \`previews/after/<slug>.html\` per screen (standalone, inline CSS, no external requests, renders exactly like the proposed code); \`previews/after/screens.json\` with **exact** before names; \`changes.json\` with \`"mode":"codebase"\`.
**Write (screenshots):** before + after previews with matching \`screens.json\`; \`changes.json\` with \`"mode":"screenshots"\`, target \`ui-audit/current/<slug>.html\`, proposed \`ui-audit/previews/after/<slug>.html\`.

### Step 6 — After audit, loop until it passes
\`audit.js --label after --previews after\` → AI review (reuse ids) → \`score.js --label after\`.
**Done when every screen scores higher than before AND passes.** Otherwise fix proposals/previews and rerun. **Max 3 loops**, then report honestly what's open and why.

### Step 7 — Report & Interactive Visual Comparison
\`node "$SKILL/scripts/report.js" --before before --after after\` then \`node "$SKILL/scripts/serve.js"\` → http://localhost:4178 (start it in background as daemon).
Manual: build \`report.html\` + \`report.md\` to the spec in \`references/formats.md\`.

**Interactive Comparison Screen Requirements:**
- **Swipe-to-Reveal Split Slider:** Provide a horizontal scrub slider that reveals "Before" and "After" on the exact same canvas with percentage controls.
- **Full-Height Expansion Mode:** Ensure screens can be viewed at full height (\`height: 100%\` / expanded) so the entire screen is visible without cramped internal scrollbars.
- **Visual Annotation Pins:** Place numbered interactive pins (❶, ❷, ❸...) directly over changed UI elements on the "After" preview. Clicking an annotation card or pin highlights the exact quality rule (e.g. U1, U2, A2, A6, R5), before issue, and after fix.
- **Responsive Viewport Switcher:** One-click toggle between Desktop (1440px), Tablet (768px), and Mobile (375px).
- **Direct Apply / Undo API:** Buttons in the sticky bar to trigger \`/api/apply\` and \`/api/undo\`.

### Step 8 — Apply (only when asked)
\`apply.js --dry-run\` → \`apply.js\` → (\`apply.js --undo\` to revert). Manual: follow the apply/undo procedure in \`references/formats.md\`.
In codebase-live, then run \`audit.js --label verify\` + \`score.js --label verify\`. If verify scores below the after previews, the previews didn't match the code — fix it and tell the user.

### Step 9 — Refine again
Repeat Steps 2–7 with labels \`before-N\`/\`after-N\`, \`"round": N\` in \`changes.json\`. Screenshot mode: copy \`ui-audit/current/\` into \`previews/before-N/\`.

### Step 10 — Gate a new screen
\`audit.js --label new-screen --name "Settings" --url /settings\` → AI review → \`score.js --label new-screen\`. If it fails, run Steps 5–7 before it ships, then add it to \`config.json\`.

## Edge cases

| Situation | Do |
| --- | --- |
| Login needed | Ask for test credentials or a logged-in URL, or use static mode. Never guess passwords. |
| SPA routing | Full URL per route; wait for network idle + \`waitMs\`. |
| Huge codebase | 3–6 main screens; static scan only their \`files\` + shared styles. |
| Tailwind / design system | Fix via theme config and existing components, not one-offs. |
| Dark mode | Audit both; contrast applies to each. |
| Multiple languages | Audit main language; flag text-expansion risk in copy findings. |
| No network / can't install | Static or screenshot mode with manual checks; say so. |
| Blurry/cropped screenshot | Review what you can; list what you couldn't check. |
| After doesn't beat before | Don't hide it. Loop (max 3), then explain the blocker. |
| User wants audit only | Still score everything; skip improve/report only if they clearly say so. |
| Client has its own rules | Map each to one of the six areas with id, check method, severity. Keep points and pass rule unchanged. |

## Final answer to the user (short, plain, real numbers only)

1. Mode and screens checked, plus anything you couldn't check.
2. Table: Screen | Before | After | Change | Result.
3. The 3–5 most important fixes in plain words.
4. Still open, and why.
5. Next step: open the report (\`node "$SKILL/scripts/serve.js"\` → http://localhost:4178) and click **Apply new changes**, or say "apply". Undo is always available.

## Checklist before answering

- [ ] Mode stated; every screen has 3-size screenshots (or the given image)
- [ ] Findings in exact format, no duplicates, no auto finding repeated by AI, stable ids
- [ ] Scores computed with the exact math and pass rule
- [ ] Proposed files complete, at mirrored paths; after previews + matching \`screens.json\` for every screen
- [ ] Every screen higher and passing (or reason explained)
- [ ] \`changes.json\` valid, paths safe; \`report.html\` + \`report.md\` built
- [ ] No real project file changed before apply; only presentation changed
`;

export class SkillLoader {
  private currentCustomSkill: string | null = null;

  /**
   * Loads the active audit skill. Priority:
   * 1. In-memory custom skill (set via API)
   * 2. Built-in hardcoded ui-audit skill (always available)
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

    return {
      name: 'UI Audit — 100-Point Quality Model',
      description: 'Audit, score, and redesign a product\'s UI against a fixed 100-point UI/UX quality model (accessibility, usability, consistency, responsiveness, states, copy).',
      rawMarkdown: BUILTIN_SKILL_MARKDOWN,
      source: 'file',
    };
  }

  /**
   * Allows dynamic injection of a custom skill via API (in-memory only).
   */
  setCustomSkill(markdown: string): void {
    this.currentCustomSkill = markdown.trim();
  }

  /**
   * Saves the custom skill to disk (kept for API compatibility).
   */
  async saveSkillToDisk(markdown: string): Promise<void> {
    const skillPath = path.resolve(process.cwd(), '../skills/audit_skill.md');
    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await fs.writeFile(skillPath, markdown, 'utf-8');
    this.currentCustomSkill = null;
  }
}

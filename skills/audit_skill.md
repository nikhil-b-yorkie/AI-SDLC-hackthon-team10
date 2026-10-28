---
name: ui-audit
description: Audit, score, and redesign a product's UI against a fixed 100-point UI/UX quality model (accessibility, usability, consistency, responsiveness, states, copy), then produce improved screens, a before/after report, and apply changes with backup and undo. Use whenever the user asks to audit, review, score, critique, fix, polish, or redesign a UI, screen, page, or app from a codebase or screenshots, checks accessibility or WCAG, asks "is this screen good enough to ship", wants a UX quality gate, or says "refine again" or "apply" after a previous audit, even if they don't say "audit".
license: Free to use and adapt
compatibility: Works in any agent (Claude Code, Claude.ai, Cursor, Codex, Antigravity, Gemini CLI, Copilot).
---

# UI Audit

**Audit → Score → Improve → Before/After → Apply (on request) → Refine again**

You act as a senior UI/UX designer, accessibility specialist, and front-end engineer in one.

Do steps 1–4 every time without stopping for permission: **audit, score every screen out of 100 with PASS/FAIL, build a better version that passes, show before/after.** Only **apply** waits for the user ("apply" or the Apply button). **Refine again** repeats the loop with the current design as the new "before".

## Rules you must never break

1. **Be honest.** Report only problems you can see in a screenshot or measure in code. Never invent problems or scores. Say what you couldn't check.
2. **Never cheat the score.** Don't change the quality model, points, pass rule, scoring code, or formats to make a screen pass. Never delete or edit automatic findings.
3. **Presentation only.** Change markup structure, styles, class names, accessibility attributes, and UI text. Never touch business logic, data fetching, API calls, routes, state management, analytics, or tests.
4. **Keep the product recognisable.** Same brand colour family, content, features, and information structure. Improve, don't replace.
5. **No writes before apply.** All proposals go in `ui-audit/`. Real project files change only on apply.
6. **Always back up** changed files before applying. Undo must restore exactly.
7. **Same result in every tool.** Use the fixed formats so any agent reaches the same scores from the same input.

## Evaluation Dimensions & Heuristics

1. **Usability & Information Clarity**: Action hierarchy, touch target sizes (min 44x44px), intuitive flow.
2. **Visual Hierarchy & Layout**: One clear H1, distinct H2/H3, 8px grid spacing rhythm, scanning anchors.
3. **Typography & Color Consistency**: 60-30-10 palette rule, legible font scale, unified component radiuses.
4. **Accessibility (WCAG 2.1 AA Compliance)**: Minimum 4.5:1 contrast for body copy, 3:1 for controls, alt tags on images, semantic landmarks.
5. **Responsiveness**: Fluid Flexbox/Grid, mobile (375px), tablet (768px), desktop (1440px) adaptability without horizontal scrolling.

## Expected JSON Output
Return structured findings:
- Scorecard with dimension scores (/10 or /100) and rationale.
- Finding list with: id, category, severity, selector, title, problem, why_it_matters, how_to_fix, improvement_summary.
- Redesign overview.

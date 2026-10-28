Step-by-step plan

1. Collect the current product

Get screenshots or codebase.
Identify the key screens and user flows.
Note the platform (desktop, mobile, responsive). 2. Run the UI/UX audit
Review the product across:

Usability and clarity
Visual hierarchy and layout
Consistency in colors, typography, and components
Accessibility basics (contrast, labels, focus states)
Responsiveness
Navigation and flow
Error states and empty states 3. Give a UI/UX score
Create a simple scorecard, for example:

Usability: /10
Visual design: /10
Consistency: /10
Accessibility: /10
Responsiveness: /10
Overall UI/UX score: /10
Include a short reason for each score. 4. List improvement points
For each issue, provide:

What the problem is
Why it matters
How to fix it
Priority: High / Medium / Low 5. Create the improved version

Redesign the key screens based on the audit.
Keep the same product purpose and content.
Improve layout, clarity, hierarchy, and consistency.
Show the improved version in high fidelity. 6. Build the comparison view
Create a side-by-side “Before vs After” comparison window:

Original screen on one side
Improved screen on the other
Short notes explaining what changed and why

7. Apply the Finding to the Existing design in which it will refine existing visual as per new suggested layout and UX (edited)

---

# UI/UX Audit & Redesign Platform

An AI-powered product that ingests a GitHub repository, audits the interface using a pluggable agent harness, synthesizes an improved high-fidelity version in pure HTML/CSS, and renders a side-by-side comparison workspace with on-hover improvement popovers.

## Features & Workflow
1. **Clone Any Repository**: Accepts public and private GitHub repository URLs (with or without a Personal Access Token / PAT). Supports shallow cloning for speed.
2. **Pluggable Audit Skill Harness**: Decoupled agent harness. Drop your custom UI/UX audit rules and heuristics into `skills/audit_skill.md` or edit/upload them directly in the UI.
3. **Pure HTML/CSS Synthesis**: Redesigns the interface in clean, high-fidelity HTML5/CSS3 with zero dynamic build dependencies. Annotated with `data-audit-*` metadata attributes.
4. **Side-by-Side Comparison Workspace**:
   - Split-screen comparison (Original vs. Improved).
   - Synchronized scrolling engine.
   - Viewport switcher (Desktop 100%, Tablet 768px, Mobile 375px).
   - Interactive **on-hover popovers** displaying improvement rationale, category, and severity.
   - UI/UX Scorecard drawer with dimension breakdown (Usability, Visuals, Consistency, Accessibility, Responsiveness) and click-to-highlight element locator.

## Quick Start

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Start Both Backend & Frontend
```bash
npm run dev
```
- **Backend API**: `http://localhost:4000`
- **Frontend App**: `http://localhost:3000`

### 3. Bring Your Own Audit Skill
Place your custom evaluation heuristics and rubrics into:
```
skills/audit_skill.md
```
Or open the **Audit Skill** modal in the top navigation bar to paste, edit, and apply it in real-time.

### 4. Running Tests
```bash
cd backend && npm test
```


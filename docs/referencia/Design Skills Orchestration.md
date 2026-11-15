# Design Skills Orchestration

## General rule

Do not invoke all design skills simultaneously. Each skill has a specific responsibility and must respect the decisions made by the previous stages.

### 1. UI/UX Pro Max — Design Intelligence
Use when:
- Starting a new product or interface.
- Defining a visual design system.
- Researching styles, typography, colors and UX patterns.
- Evaluating design alternatives.

Rules:
- Generate a design system before implementation.
- Explain why each visual decision fits the product.
- Persist approved decisions in `design-system/MASTER.md`.
- Do not independently redesign an already approved design system.

### 2. Frontend Design — Interface Creation
Use when:
- Building new pages or components.
- Implementing approved visual designs.
- Creating distinctive layouts and interactions.

Rules:
- Follow the approved design system.
- Do not introduce new colors, typography or visual styles without justification.
- Prioritize usability, accessibility and responsive behavior.
- Avoid generic AI-generated design patterns.

### 3. Impeccable — Design Review and Refinement
Use when:
- Reviewing existing interfaces.
- Improving visual hierarchy and usability.
- Auditing accessibility and responsive behavior.
- Refining and polishing existing components.

Rules:
- Preserve the established visual identity.
- Do not replace approved design decisions without justification.
- Prioritize improvements based on severity and impact.
- Request approval before substantial redesigns.

## Source of truth

The project design system is the source of truth.

When skills produce conflicting recommendations:
1. Preserve explicit user decisions.
2. Follow the approved design system.
3. Explain the conflict.
4. Present alternatives when necessary.
5. Never silently override established decisions.

## Existing functionality protection

Visual improvements must not modify:
- Business logic.
- Database structures.
- API contracts.
- User permissions or roles.
- Existing functionality.

Unless explicitly requested by the user.

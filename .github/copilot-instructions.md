# Copilot Instructions

## Code Style: Write Like a Human

Write and edit code so it reads like a real developer wrote it. Keep it simple and lightly commented.

- **Comment why, not what.** Only comment non-obvious reasoning, tradeoffs, or workarounds. Never narrate the next line or label obvious blocks (`// loop through rows`).
- **Don't over-engineer.** No helper, interface, or option for a single use. Solve the actual problem, not imagined future ones.
- **Keep it direct.** Prefer the straightforward version over the clever one. Use early returns instead of deep nesting.
- **Match the file.** Mirror existing naming, spacing, and patterns before imposing new ones. Use short, plain names.
- **Validate only at real boundaries** (user input, network, file I/O). Trust internal code.
- **Don't touch what you didn't change.** No adding comments, docstrings, or types to untouched code.

For full before/after examples and a pre-finish checklist, see the [`human-style-code`](./skills/human-style-code/SKILL.md) skill.

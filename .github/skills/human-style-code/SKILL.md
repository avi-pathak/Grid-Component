---
name: human-style-code
description: 'Write or refactor code so it reads like a human developer wrote it: minimal comments, simple and direct solutions, no over-engineering. Use when the user asks for human-written / natural code, fewer or less comments, simpler code, "make it look human", removing AI tells, or cleaning up over-commented / over-abstracted code.'
argument-hint: 'Optional: file or selection to rewrite in a human style'
---

# Human-Style Code

Write code that looks like a real developer wrote it under normal time pressure — clear, simple, and lightly commented. Avoid the "AI tells": comment-on-every-line, defensive checks for impossible cases, and abstractions invented for a single use.

## When to Use

- The user asks for code that is "human-written", "natural", or "not AI-looking".
- The user asks to reduce, trim, or remove comments.
- The user wants simpler, less complex, or less "enterprise" code.
- Cleaning up generated code that is over-commented or over-engineered.
- Any new code where the goal is to blend into a real, hand-written codebase.

## Principles

1. **Comment why, not what.** Only add a comment when the reasoning isn't obvious from the code. Never narrate the next line.
2. **Solve the actual problem.** No abstractions, options, or config for cases that don't exist yet. One use means no helper.
3. **Keep it flat and direct.** Prefer the straightforward version over a clever one. Early returns over deep nesting.
4. **Match the surrounding code.** Mirror the existing naming, spacing, quote style, and patterns in the file before imposing your own.
5. **Name things normally.** Short, plain names. `rows`, `total`, `handleClick` — not `rowDataCollection` or `clickEventHandlerCallback`.
6. **Don't over-validate.** Check input only at real boundaries (user input, network, file I/O). Trust your own internal code.
7. **Leave it slightly imperfect.** Real code isn't uniformly documented or perfectly symmetrical. Don't add docstrings/types/comments to things you didn't need to touch.

## Comments

Keep comments rare and useful. A good comment explains a decision, a tradeoff, a workaround, or a non-obvious constraint.

Remove or never write comments that:

- Restate the code: `// increment i` above `i++`.
- Label obvious blocks: `// loop through rows`, `// return result`.
- Describe types already in the signature.
- Tag every function with a full doc block when the name already says it.

## Examples

**Over-commented → human**

```ts
// Before — narrates every step
function getTotal(items: Item[]): number {
  // initialize the total to zero
  let total = 0;
  // loop through each item in the array
  for (const item of items) {
    // add the item price to the total
    total += item.price;
  }
  // return the final total
  return total;
}

// After — the code already explains itself
function getTotal(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  return total;
}
```

**Over-engineered → simple**

```ts
// Before — abstraction and config for a single call site
interface FormatOptions { uppercase?: boolean; trim?: boolean; fallback?: string; }
function formatName(name: string | null, opts: FormatOptions = {}): string {
  const { uppercase = false, trim = true, fallback = "Unknown" } = opts;
  let result = name ?? fallback;
  if (trim) result = result.trim();
  if (uppercase) result = result.toUpperCase();
  return result;
}

// After — write what's actually needed
function formatName(name: string | null): string {
  return (name ?? "Unknown").trim();
}
```

**Useful comment (keep this kind)**

```ts
// Grid measures rows lazily, so height is only known after the first paint.
requestAnimationFrame(measureRows);
```

## Before You Finish

- [ ] Every remaining comment explains *why*, not *what*.
- [ ] No helper, interface, or option exists for a single use.
- [ ] Naming and style match the rest of the file.
- [ ] Fewer comments.
- [ ] No validation for cases that can't happen.
- [ ] Nothing was touched (comments, types, formatting) outside what the task needed.

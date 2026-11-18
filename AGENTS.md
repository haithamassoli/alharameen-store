# Alharameen Store — Agent Guide

Astro 7 static storefront. TypeScript strict, pnpm, PWA via `@vite-pwa/astro`.

## Commands

| Task | Command |
| --- | --- |
| Dev server | `astro dev --background` (manage with `astro dev stop/status/logs`) |
| Format + lint (Oxfmt + Oxlint type-aware + anti-slop) | `pnpm fix` / `pnpm check` |
| Typecheck | `pnpm typecheck` |
| Dead code / unused deps | `pnpm knip` |
| Unit tests (Vitest, `src/**/*.test.ts`) | `pnpm test` |
| E2E + axe a11y (Playwright, `e2e/`) | `pnpm test:e2e` |
| Spelling | `typos` (native binary: `brew install typos-cli`) |
| Everything CI runs | `pnpm validate` |
| Regenerate PWA icons | `pnpm pwa:assets` (source: `public/favicon.svg`) |

## Definition of done

Run `pnpm validate` (and `pnpm test:e2e` for UI changes) before you call a task finished. It must pass with zero errors. Never silence a rule with `oxlint-disable`, `@ts-ignore` or `as any` to get green; fix the code. If a rule is truly wrong for this repo, change the config in `oxlint.config.ts` / `oxfmt.config.ts` and say why in the commit.

## Project rules

- **Astro first.** Ship zero JS by default. Add a `<script>` or a client island only when the feature needs interactivity; prefer `client:visible`/`client:idle` over `client:load`.
- **Files.** Components and layouts are `PascalCase.astro`; everything else is `kebab-case`. Pages in `src/pages`, components in `src/components`, layouts in `src/layouts`, shared logic in `src/lib`. No barrel `index.ts` files.
- **Content.** Product/catalog data goes in content collections (`src/content.config.ts`) with a Zod schema, not hard-coded arrays in pages.
- **Money.** Store prices as integers in minor units (fils/halalas) with an explicit ISO currency code. Format with `Intl.NumberFormat` at render time. Never do currency math with floats. Prices and stock shown on the client are display-only; validate them server-side at checkout.
- **i18n / RTL.** The store targets Arabic. Use logical CSS properties (`margin-inline-start`, `padding-inline`, `inset-inline-end`) instead of left/right, and set `lang`/`dir` on `<html>` per locale.
- **Images.** Use `astro:assets` (`<Image>`/`<Picture>`) with `alt`, `width`, `height`.
- **Secrets.** Read config via `astro:env` / `import.meta.env`. Never commit `.env` files, API keys or tokens. Only `PUBLIC_` vars may reach the client.
- **PWA.** The service worker is generated at build. Don't hand-edit `dist/` or `sw.js`; change `astro.config.mjs`. Updates ship automatically (`registerType: "autoUpdate"`). Never cache cart, account, checkout or payment responses in the service worker.
- **Dependencies.** Prefer platform/stdlib and existing deps. Adding a dependency needs a reason in the commit body. Use `pnpm add`, never npm/yarn.
- **Tests.** Logic in `src/lib` (pricing, cart, inventory) gets a colocated `*.test.ts`. Pages get a Playwright smoke test with an axe scan; static lint does not check `.astro` template a11y.
- **Commits.** Conventional Commits (`feat:`, `fix:`, `chore:` …), enforced by commitlint.
- **Scope.** Make the smallest change that solves the task. No speculative abstractions, no unrelated refactors, no new files "for later".

## Git hooks (Lefthook)

- pre-commit: `ultracite fix` (Oxfmt + Oxlint) on staged files (auto re-staged), typos
- commit-msg: commitlint
- pre-push: typecheck + knip + unit tests

Agent hooks in `.claude/`, `.codex/` and `.cursor/` run `ultracite fix` after every edit.

## Astro docs

Full documentation: https://docs.astro.build — consult before related work:

- [Routing, dynamic routes, middleware](https://docs.astro.build/en/guides/routing/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Framework components](https://docs.astro.build/en/guides/framework-components/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Styling](https://docs.astro.build/en/guides/styling/)
- [Internationalization](https://docs.astro.build/en/guides/internationalization/)
- [Images](https://docs.astro.build/en/guides/images/)

## Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

### Quick Reference

- **Format code**: `pnpm exec ultracite fix`
- **Check for issues**: `pnpm exec ultracite check`
- **Diagnose setup**: `pnpm exec ultracite doctor`

Oxlint (type-aware via tsgolint, plus the anti-slop plugin) lints and Oxfmt formats. Most issues are automatically fixable.

---

### Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Write functions as arrow functions assigned to `const`, and define them above where they're used
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### Accessibility

- Use semantic HTML first; add ARIA only when no native element fits
- Provide meaningful alt text for images
- Use proper heading hierarchy
- Add labels for form inputs
- Make anything clickable a `<button>` or a link, so it works from the keyboard; don't add key handlers to a `<div>`
- Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns
- Avoid import cycles; move shared code into a module both sides import
- Don't leave TODO or FIXME comments in new code. For an existing one, do the task, delete it if it's done, or leave it; never reword it to get past the linter

### Security

- Add `rel="noopener noreferrer"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Avoid barrel files (index files that only re-export other modules) inside an app; a package's entry point is fine
- Use Astro `<Image>`/`<Picture>` from `astro:assets` over raw `<img>` tags

---

### Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

### When the Linter Can't Help

Oxlint will catch most mechanical issues automatically. Focus your attention on:

1. **Business logic correctness** - the linter can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxfmt and Oxlint. Run `pnpm exec ultracite fix` before committing to ensure compliance.

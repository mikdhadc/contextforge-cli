/**
 * Built-in slash command template bodies.
 * Each template uses $ARGUMENTS as the placeholder for user-supplied input.
 * Templates reference MCP tools so the AI can pull live project context.
 */

export const TEMPLATE_CONTENT: Record<string, string> = {
  feature: `\
# Feature: $ARGUMENTS

Before writing any code, call the \`get_relevant_context\` MCP tool with
\`feature_area\` set to "$ARGUMENTS" to pull the relevant .context.md sections.
Then call \`get_project_conventions\` to review naming and import conventions.

## Implementation checklist

- [ ] Identify the correct module / directory from the **Structure** section
- [ ] Follow the naming convention detected for this project (files, exports, tests)
- [ ] Match the import style (barrel vs. direct, aliased paths)
- [ ] Write tests in the detected test framework, co-located or in the detected test dir
- [ ] If this introduces an architectural choice, call \`log_decision\` with topic, decision, and rationale

## Definition of Done

- Feature code follows detected conventions (no ⚠ contested patterns without explicit choice)
- Tests added and passing
- Decision logged if architectural
`,

  bugfix: `\
# Bug Fix: $ARGUMENTS

Call \`get_relevant_context\` with \`feature_area\` set to "$ARGUMENTS" to load
relevant context. Check \`.contextforge/decisions.jsonl\` for prior decisions
that may be related.

## Investigation steps

1. Reproduce the issue with a failing test or minimal script
2. Identify root cause — check for anti-patterns flagged in .context.md
3. Fix with minimum blast radius; do not refactor unrelated code
4. Add a regression test that would have caught the bug

## Checklist

- [ ] Root cause identified and documented in a code comment
- [ ] Fix scoped to minimum change
- [ ] Regression test added
- [ ] No new anti-patterns introduced
- [ ] If fix changes a prior decision, call \`log_decision\` to record the update
`,

  refactor: `\
# Refactor: $ARGUMENTS

Call \`get_project_conventions\` first. Pay special attention to any ⚠ **contested**
conventions — those indicate the codebase is mid-migration and you should align
your changes with the majority pattern.

## Steps

1. Map the blast radius: list every file that imports the target
2. Decide on the target pattern (check conventions + prior decisions)
3. Apply changes incrementally — one logical unit at a time
4. Update all imports and references
5. Run tests after each logical unit

## Checklist

- [ ] Blast radius mapped before starting
- [ ] Target pattern chosen and consistent with majority convention
- [ ] All imports / references updated
- [ ] Tests green
- [ ] Decision logged: what was changed and why
`,

  review: `\
# Code Review: $ARGUMENTS

Load conventions with \`get_project_conventions\`, then use \`get_relevant_context\`
with the changed area to understand expected patterns.

## Review dimensions

### Naming & structure
- [ ] Files, functions, and variables follow detected naming convention
- [ ] New directories placed in expected locations (see Structure section)

### Imports
- [ ] Import style matches detected pattern (barrel / direct / aliased)
- [ ] No circular dependencies introduced

### Logic & safety
- [ ] No new anti-patterns from the Anti-patterns section of .context.md
- [ ] Error handling consistent with project patterns
- [ ] No secrets, credentials, or PII in code or comments

### Tests
- [ ] New code has tests
- [ ] Tests follow detected co-location or directory pattern
- [ ] Edge cases covered

### Decisions
- [ ] Any new architectural choices are logged with \`log_decision\`
`,

  explain: `\
# Explain: $ARGUMENTS

Call \`get_relevant_context\` with \`feature_area\` set to "$ARGUMENTS", then
provide a structured explanation covering:

1. **Purpose** — what problem this solves in the project
2. **Role** — where it sits in the architecture (see Structure section)
3. **Key dependencies** — what it imports and what imports it
4. **Conventions it exemplifies** — naming, patterns, test approach
5. **Anti-patterns to avoid** — what NOT to do when modifying this area
6. **Prior decisions** — any logged decisions that shaped the current design

Keep the explanation grounded in the actual project context, not generic advice.
`,
};

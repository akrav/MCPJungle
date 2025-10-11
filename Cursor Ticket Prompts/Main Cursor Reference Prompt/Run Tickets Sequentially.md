### Cursor Prompt: Run all tickets sequentially until done

You are in auto-run mode. Execute tickets one by one, in ascending numeric order, across all `Cursor Ticket Prompts/Prompts/Epic */Sprint */TICKET-### Prompt.md` files.

Loop for each ticket:
- Find the next prompt file not yet completed (look for the lowest TICKET-### without “Status: Completed” in its referenced ticket file).
- Read that `TICKET-### Prompt.md` and the referenced `Epics/Epic */Sprint */Ticket-###.md`.
- Implement the ticket fully. Make edits across the repo as needed.
- Run tests after each meaningful edit until green:
  - Try (in this order, adapt to project): `npm run test:unit`, `npm run test:int` (or `pytest -q`), and if a milestone suite exists, run it too.
  - If tests fail, fix and rerun. Repeat until all pass.
- When green:
  - Mark completion in the ticket file by appending a short “Status: Completed – <YYYY-MM-DD>” note.
  - Update `Build Documentation/Sprint-Progress.md` for this ticket’s status.
  - Commit with message: `feat: TICKET-### complete (tests green)`.
- Move to the next ticket and repeat.

Stop conditions:
- If you hit >5 consecutive failing test cycles on the same ticket, pause and ask for help.
- If no remaining tickets are found, report “All tickets completed”.

Conventions:
- Never commit secrets. If configuration is needed, add placeholders to `.env.example` and update README.
- Keep changes scoped to the ticket.
- Do not pause between tickets for approval. Immediately start the next ticket unless a stop condition is met.

### Auto-continue (Cursor)
- Keep Cursor auto-run/auto-apply (autopilot) enabled. Do not prompt for confirmation between tickets.
- Prefer non-interactive flags in commands to avoid blocking (e.g., `--yes` where applicable).
- Only pause on the defined stop conditions above.


Git: commit and push on Epic_1_mcp_orchestrator_pass_through After Completion of any Ticket (only after tests are green)

- Ensure we are on Epic_1_mcp_orchestrator_pass_through (create/switch if needed)
- If there are changes, commit and push

Commands:
```bash
# ensure branch
git checkout -B Epic_1_mcp_orchestrator_pass_through

# commit only if there are changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  git add -A
  git commit -m "feat: TICKET-${ticketId} complete (tests green)"
  git pull --rebase origin Epic_1_mcp_orchestrator_pass_through || true
  git push -u origin Epic_1_mcp_orchestrator_pass_through
fi
```

Atomic commit boundary & clean-tree guard (pre-next-ticket)

Before starting the next ticket, assert the working tree is clean so commits stay one ticket per commit. If not clean, treat remaining changes as part of the just-finished ticket: fix, test, commit, and push before proceeding.

Commands:
```bash
# verify clean working tree and index before starting the next ticket
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree not clean; finish current ticket (test/commit/push) before starting next." >&2
  exit 1
fi
```

### Repo hygiene (.gitignore)
- Ensure repository root `.gitignore` includes at least:
```
**/node_modules/
**/dist/
.env
.env.*
coverage/
```
- Never commit secrets or credentials. Use `.env.example` placeholders and document required variables in README.

### Selection filters (optional)
At invocation time, you may be asked to limit the run to a specific sprint or a range/list of ticket IDs. Apply these filters before iterating.

- Sprint filter: If the user message contains `sprint <N>` or `sprints <N1, N2>` (case-insensitive), only include prompts under those sprint folders (e.g., `Sprint 3`).
- Ticket filter: If the user message contains `tickets <A-B>` (range) or `tickets <A,B,C>` (comma list), only include those ticket IDs across the selected sprint scope.
- Ordering: After filtering, sort remaining tickets by numeric ID ascending and proceed as usual.
- Defaults: If no filters are provided, run the full project loop (all sprints, all tickets).

Examples the user might say (interpret accordingly):
- “start sprint build Sprint 3” → include only `Cursor Ticket Prompts/Prompts/Epic 1/Sprint 3/*`.
- “start sprint build Sprint 2, Sprint 3” → include only Sprints 2 and 3.
- “start ticket build 201-210” → include tickets 201 through 210 across included sprints.
- “start ticket build 111,114,115” → include only those ticket IDs.

### Invocation phrases (for short User Rules)
- Full build: “start full build” → follow this file with no filters.
- Sprint build: “start sprint build <Sprint N[, Sprint M,...]>” → set sprint filter.
- Ticket range/list: “start tickets build <A-B|A,B,C>” → set ticket filter (optionally combine with sprint filter if both are present).


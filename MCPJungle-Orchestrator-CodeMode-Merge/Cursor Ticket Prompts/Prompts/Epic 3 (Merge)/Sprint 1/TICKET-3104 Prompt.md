### Cursor Prompt: Execute Ticket TICKET-3104

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3104
- TICKET_NAME: Ticket-3104 — Prompt builder (emit-code-only contract)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 1/Ticket-3104.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md
- Sprint Planning: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint Planning/Sprint Planning.md
- Project Structure: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/structure.md
- Troubleshooting: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Troubleshooting.md
- Sprint Progress: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Sprint-Progress.md

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/prompt.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint1-codemode/prompt_contract.spec.ts

Objective:
- Build a concise prompt instructing the model to emit only code (a single async function using `codemode`) with listed functions.

Required steps:
1) Implement prompt builder with names/descriptions and guardrails.
2) Add tests validating content and guard phrases.
3) Run tests: `npm run test -- tests/sprint1-codemode/prompt_contract.spec.ts`.

Success criteria:
- Prompt includes all function names, “output only code”, “single async function”; no secrets.

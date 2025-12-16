# Ticket-4402 — User Prompt Interface (CLI/Log)

**What / Why**
For the MVP, we need a way to "ask" the user. Since this Orchestrator is a server process (likely running in a terminal or background), it doesn't have a GUI to pop up a modal.
Therefore, we output a **Structured Log Message** to the terminal (where the user is watching the logs) listing the options. The user then needs a way to "answer" the question. Since they can't click a button in the log, we instruct them to send a command (a curl/POST request) to the server to make their choice.

**Where**
`/src/discovery/interaction/prompt.ts`

**Implementation Sketch**
*   Create `/src/discovery/interaction/prompt.ts`.
*   Export `requestUserSelection(requestId: string, candidates: Tool[])`.
*   **Logic**:
    1.  Format the candidates into a readable table (Name, Price, Rating, ID).
    2.  Construct a message: "ACTION REQUIRED: Manual selection for Request {requestId}. Please pick a tool:"
    3.  Log this to `console.warn` (or the logger from Sprint 0) so it stands out.
    4.  Include instructions: "Run the following command to select Tool #1: `curl -X POST http://localhost:PORT/admin/select-tool -d '{\"requestId\": \"...\", \"toolId\": \"...\"}'`"

**Tests**
`/tests/sprint4-4/prompt.spec.ts`:
*   **Spy** on `console.warn`.
*   **Test**: Call `requestUserSelection` with 3 tools.
*   **Assert**: The output contains the curl command instructions and the tool IDs.

**Accept When**
The system outputs a clear instruction that tells the user exactly how to respond.

**LLM Priming (keywords/APIs)**
`CLI Table`, `console.table`, `User Interaction`, `Structured Logging`

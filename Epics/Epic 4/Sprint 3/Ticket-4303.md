# Ticket-4303 — Discovery Interceptor (Middleware)

**What / Why**
We need to catch requests for tools that don't exist yet. Instead of failing immediately with a 404/MethodNotFound, we intercept this specific error and trigger the discovery process.

**Where**
`/src/server/interceptor.ts`, `/src/server/router.ts`

**Implementation Sketch**
*   Create `/src/server/interceptor.ts`.
*   Export `handleToolNotFound(req: Request, res: Response, next: NextFunction)`. (Or equivalent for the MCP transport layer).
*   **Logic**:
    1.  Wrap the main request handler in a try/catch (or use a dedicated error middleware).
    2.  Check if error code is `-32601` (Method not found) or internal 404 equivalent.
    3.  Extract `userId` and the `method` (tool name) or `params.description` (intent) from the request.
    4.  Call `DiscoveryService.resolveMissingTool(userId, intent)` (Stub for now, wired in next ticket).
    5.  If resolved (`true`), we will need to **retry** (handled in Ticket 4305).
    6.  If NOT resolved (`false`), pass the original error to the client.

**Tests**
`/tests/sprint4-3/interceptor.spec.ts`:
*   **Mock Discovery**: Create a mock service that returns `false` (not found).
*   **Test**: Simulate a request for a missing tool.
*   **Assert**: The interceptor calls the discovery service.
*   **Assert**: When discovery fails, the client still receives the original error (graceful degradation).

**Accept When**
The system attempts discovery on 404, but fails gracefully if nothing is found.

**LLM Priming (keywords/APIs)**
`Express Error Middleware`, `Request Interception`, `JSON-RPC Error Handling`

### Role & lifecycle (constant)

We are building an **MCP Orchestrator** that is itself an **MCP server** to the host (e.g., ChatGPT) and an **MCP client** to multiple downstream MCP servers (one per alias).  
All work in this sprint must preserve the MCP order: **initialize → capability negotiation → operate (tools/resources/prompts + progress/cancel/pagination/logging) → shutdown**.  
Routing is strictly `alias.tool`; progress/cancel are bridged both ways; no roots/scopes broadening.  


Please read and execute what is written in /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 1/Sprint 0/TICKET-101 Prompt.md 
Please make sure you test every ticket. and you use the prompt permanent references to fill in information about this project
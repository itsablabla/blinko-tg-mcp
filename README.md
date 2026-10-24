# blinko-tg-mcp

HTTP MCP server over the Blinko Cloud Agent API. Hosts `create_note` and `list_notes`.

Auth: every request must carry `Authorization: Bearer <BLINKO_API_KEY>` (same header used to reach Blinko).

Tools:
- `create_note` - POST /api/agent/note
- `list_notes` - GET /api/agent/note?limit=

Run: `PORT=8080 BLINKO_API_URL=https://api.blinko.space BLINKO_API_KEY=... node index.js`

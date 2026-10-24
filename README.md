# blinko-tg-mcp

Streamable-HTTP MCP server for Blinko Cloud, backed by the Agent API
(https://api.blinko.space/api/agent/*).

## Env
- `BLINKO_API_KEY` (required)
- `BLINKO_API_URL` (default https://api.blinko.space)
- `PORT` (default 8080)

## Tools
- `create_note(content, type?)` - create a Blinko note (NOTE or BLINK)
- `list_notes(limit?)` - list recent notes

## Security
Every request must send `Authorization: Bearer <BLINKO_API_KEY>`.

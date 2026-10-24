import http from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const KEY = process.env.BLINKO_API_KEY;
if (!KEY) { console.error("BLINKO_API_KEY required"); process.exit(1); }
const URL = (process.env.BLINKO_API_URL || "https://api.blinko.space").replace(/\/$/, "");
const PORT = Number(process.env.PORT || 8080);

function buildServer() {
  const srv = new McpServer({ name: "blinko", version: "1.0.0" });
  srv.tool("create_note",
    { content: z.string().describe("note content"), type: z.enum(["BLINK", "NOTE"]).optional() },
    async ({ content, type }) => {
      const r = await fetch(URL + "/api/agent/note", {
        method: "POST",
        headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json", "User-Agent": "blinko-mcp" },
        body: JSON.stringify({ content, type: type || "NOTE" }),
      });
      const t = await r.text();
      if (!r.ok) throw new Error("Blinko " + r.status + ": " + t.slice(0, 200));
      return { content: [{ type: "text", text: t }] };
    });
  srv.tool("list_notes",
    { limit: z.number().int().min(1).max(100).optional() },
    async ({ limit }) => {
      const r = await fetch(URL + "/api/agent/note?limit=" + (limit || 20), { headers: { Authorization: "Bearer " + KEY, "User-Agent": "blinko-mcp" } });
      const j = await r.json();
      const items = (j && (j.data && j.data.items || j.items)) || [];
      return { content: [{ type: "text", text: JSON.stringify(items.map((n) => ({ id: n.id, createdAt: n.createdAt, content: (n.content || "").slice(0, 300) }))) }] };
    });
  return srv;
}

const sessions = new Map();
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };

http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if ((req.headers.authorization || "") !== "Bearer " + KEY) { res.writeHead(401, CORS); return res.end("unauthorized"); }
  if (req.method !== "POST") { res.writeHead(405, CORS); return res.end("method not allowed"); }
  const sessionId = String(req.headers["mcp-session-id"] || "");
  let entry = sessionId ? sessions.get(sessionId) : null;
  const isNew = !entry;
  if (isNew) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: () => {},
    });
    const srv = buildServer();
    try {
      await srv.connect(transport);
    } catch (e) {
      res.writeHead(500); return res.end(String(e));
    }
    transport.onclose = () => { sessions.delete(transport.sessionId); srv.close().catch(() => {}); };
    entry = { transport, srv };
  }
  try {
    await entry.transport.handleRequest(req, res);
    if (isNew && entry.transport.sessionId) sessions.set(entry.transport.sessionId, entry);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.writeHead(500); res.end(String(e)); }
  }
}).listen(PORT, () => console.log("blinko mcp listening on " + PORT));

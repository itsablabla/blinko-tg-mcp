import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const KEY = process.env.BLINKO_API_KEY;
if (!KEY) { console.error("BLINKO_API_KEY required"); process.exit(1); }
const URL = (process.env.BLINKO_API_URL || "https://api.blinko.space").replace(/\/$/, "");
const PORT = Number(process.env.PORT || 8080);

const server = new McpServer({ name: "blinko", version: "1.0.0" });

server.tool("create_note", { content: z.string().describe("note content"), type: z.enum(["BLINK", "NOTE"]).optional() },
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

server.tool("list_notes", { limit: z.number().int().min(1).max(100).optional() },
  async ({ limit }) => {
    const r = await fetch(URL + "/api/agent/note?limit=" + (limit || 20), { headers: { Authorization: "Bearer " + KEY, "User-Agent": "blinko-mcp" } });
    const j = await r.json();
    const items = (j && (j.data && j.data.items || j.items)) || [];
    return { content: [{ type: "text", text: JSON.stringify(items.map((n) => ({ id: n.id, createdAt: n.createdAt, content: (n.content || "").slice(0, 300) }))) }] };
  });

const transports = new Map();
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };

http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if ((req.headers.authorization || "") !== "Bearer " + KEY) { res.writeHead(401, CORS); return res.end("unauthorized"); }
  if (req.method !== "POST") { res.writeHead(405, CORS); return res.end("method not allowed"); }
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => require("node:crypto").randomUUID(), onsessioninitialized: () => {} });
    transports.set(transport.sessionId, transport);
    await server.connect(transport);
    await transport.handleRequest(req, res);
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (transport.sessionId && transports.has(transport.sessionId) && res.writableEnded) transports.delete(transport.sessionId);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.writeHead(500); res.end(String(e)); }
  }
}).listen(PORT, () => console.log("blinko mcp listening on " + PORT));

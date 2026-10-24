#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = (process.env.BLINKO_API_URL || "https://api.blinko.space").replace(/\/$/, "");
const API_KEY = process.env.BLINKO_API_KEY;
if (!API_KEY) { console.error("BLINKO_API_KEY is required"); process.exit(1); }

async function callBlinko(path, opts = {}) {
  const res = await fetch(API_URL + path, {
    ...opts,
    headers: { Authorization: "Bearer " + API_KEY, ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error("Blinko " + res.status + ": " + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

const server = new McpServer({ name: "blinko-tg-mcp", version: "0.1.0" });

server.tool("create_note", { content: z.string().describe("note content"), type: z.enum(["note", "blink"]).optional().describe("note type; default note") },
  async ({ content, type }) => {
    const out = await callBlinko("/api/agent/note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, type: (type || "note").toLowerCase() }) });
    return { content: [{ type: "text", text: JSON.stringify(out?.data || out) }] };
  });

server.tool("list_notes", { limit: z.number().int().min(1).max(100).optional().describe("max notes; default 20") },
  async ({ limit }) => {
    const out = await callBlinko("/api/agent/note?limit=" + (limit || 20));
    const items = out?.data?.items || out?.items || [];
    return { content: [{ type: "text", text: JSON.stringify(items.map((n) => ({ id: n.id, createdAt: n.createdAt, content: (n.content || "").slice(0, 200) }))) }] };
  });

const transport = new StdioServerTransport();
await server.connect(transport);

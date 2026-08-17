import type { UIMessage } from "ai";
import { pool } from "./db";

export type PersistedMessage = {
  id: string;
  role: string;
  content: string;
  parts: UIMessage["parts"] | null;
  phase: string | null;
  createdAt: string;
};

let hasPartsColumn: boolean | null = null;

async function partsColumnExists(): Promise<boolean> {
  if (hasPartsColumn !== null) return hasPartsColumn;
  try {
    const r = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'messages' AND column_name = 'parts'`
    );
    hasPartsColumn = (r.rowCount ?? 0) > 0;
  } catch {
    hasPartsColumn = false;
  }
  return hasPartsColumn;
}

function parseParts(raw: unknown): UIMessage["parts"] | null {
  if (Array.isArray(raw)) return raw as UIMessage["parts"];
  return null;
}

export function extractText(parts: UIMessage["parts"]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

export async function saveUserMessage(
  conversationId: string,
  userId: string,
  content: string
): Promise<PersistedMessage | null> {
  const hasParts = await partsColumnExists();
  const sql = hasParts
    ? `INSERT INTO messages ("conversationId", role, content, parts)
       SELECT $1, 'user', $2, $3::jsonb
       FROM conversations
       WHERE id = $1 AND "userId" = $4
       RETURNING id, role, content, parts, phase, "createdAt"`
    : `INSERT INTO messages ("conversationId", role, content)
       SELECT $1, 'user', $2
       FROM conversations
       WHERE id = $1 AND "userId" = $3
       RETURNING id, role, content, phase, "createdAt"`;

  const params = hasParts
    ? [conversationId, content, JSON.stringify([{ type: "text", text: content }]), userId]
    : [conversationId, content, userId];

  const result = await pool.query(sql, params);
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return { ...row, parts: parseParts(row.parts) };
}

export async function saveAssistantMessage(
  conversationId: string,
  userId: string,
  message: { content: string; parts: UIMessage["parts"] }
): Promise<PersistedMessage | null> {
  const hasParts = await partsColumnExists();
  const sql = hasParts
    ? `INSERT INTO messages ("conversationId", role, content, parts)
       SELECT $1, 'assistant', $2, $3::jsonb
       FROM conversations
       WHERE id = $1 AND "userId" = $4
       RETURNING id, role, content, parts, phase, "createdAt"`
    : `INSERT INTO messages ("conversationId", role, content)
       SELECT $1, 'assistant', $2
       FROM conversations
       WHERE id = $1 AND "userId" = $3
       RETURNING id, role, content, phase, "createdAt"`;

  const params = hasParts
    ? [conversationId, message.content, JSON.stringify(message.parts), userId]
    : [conversationId, message.content, userId];

  const result = await pool.query(sql, params);
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return { ...row, parts: parseParts(row.parts) };
}

export async function listConversationMessages(
  conversationId: string
): Promise<PersistedMessage[]> {
  const hasParts = await partsColumnExists();
  const select = hasParts
    ? `id, role, content, parts, phase, "createdAt"`
    : `id, role, content, phase, "createdAt"`;

  const { rows } = await pool.query(
    `SELECT ${select}
     FROM messages
     WHERE "conversationId" = $1
     ORDER BY "createdAt", id`,
    [conversationId]
  );
  return rows.map((r) => ({ ...r, parts: parseParts(r.parts) }));
}

export function toUIMessage(row: PersistedMessage): UIMessage {
  const parts =
    row.parts && row.parts.length > 0
      ? row.parts
      : ([{ type: "text", text: row.content }] as UIMessage["parts"]);
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    parts,
  };
}

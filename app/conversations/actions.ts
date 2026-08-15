"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  return session.user.id;
}

export async function createConversation() {
  const userId = await requireUserId();
  const {
    rows: [conversation],
  } = await pool.query<{ id: string }>(
    `INSERT INTO conversations ("userId") VALUES ($1) RETURNING id`,
    [userId]
  );
  redirect(`/conversations/${conversation.id}`);
}

export async function addMessage(conversationId: string, formData: FormData) {
  const userId = await requireUserId();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;

  const result = await pool.query(
    `INSERT INTO messages ("conversationId", role, content)
     SELECT $1, 'user', $2
     FROM conversations
     WHERE id = $1 AND "userId" = $3`,
    [conversationId, content, userId]
  );

  if (result.rowCount === 0) {
    redirect("/conversations");
  }
}
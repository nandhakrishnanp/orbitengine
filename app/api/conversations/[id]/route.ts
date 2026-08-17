import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { listConversationMessages } from "@/lib/messages";
import { destroySandbox } from "@/lib/sandbox";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const conversationResult = await pool.query(
    `SELECT id, status, "sandboxId", "createdAt" FROM conversations WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );
  if (conversationResult.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await listConversationMessages(id);

  return NextResponse.json({
    conversation: conversationResult.rows[0],
    messages,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const ownership = await pool.query(
    `SELECT id, "sandboxId" FROM conversations WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );
  if (ownership.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sandboxId = ownership.rows[0].sandboxId;

  // Destroy the sandbox, then permanently delete the conversation and its
  // messages (cascaded via the foreign key).
  await destroySandbox(id);

  await pool.query(
    `DELETE FROM conversations WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );

  return NextResponse.json({ deleted: true, sandboxId });
}

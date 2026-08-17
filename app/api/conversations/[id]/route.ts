import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
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

  const { rows: messages } = await pool.query(
    `SELECT role, content, phase, "createdAt"
     FROM messages
     WHERE "conversationId" = $1
     ORDER BY "createdAt"`,
    [id]
  );

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

  // Destroy the sandbox; conversation history stays untouched (ADR-0001).
  await destroySandbox(id);

  const { rows } = await pool.query(
    `UPDATE conversations
     SET status = 'closed', "sandboxId" = NULL, "updatedAt" = now()
     WHERE id = $1
     RETURNING id, status, "createdAt"`,
    [id]
  );

  return NextResponse.json({ conversation: rows[0] });
}

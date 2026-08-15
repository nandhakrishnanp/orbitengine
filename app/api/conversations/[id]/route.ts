import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

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
    `SELECT id, status, "createdAt" FROM conversations WHERE id = $1 AND "userId" = $2`,
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
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { content } = await request.json();
  const trimmed = String(content ?? "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO messages ("conversationId", role, content)
     SELECT $1, 'user', $2
     FROM conversations
     WHERE id = $1 AND "userId" = $3
     RETURNING id, role, content, phase, "createdAt"`,
    [id, trimmed, session.user.id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ message: result.rows[0] }, { status: 201 });
}
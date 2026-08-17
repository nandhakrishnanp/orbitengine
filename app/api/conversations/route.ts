import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows } = await pool.query(
    `SELECT c.id, c.status, c."createdAt", c."updatedAt",
            (SELECT m.content FROM messages m
             WHERE m."conversationId" = c.id AND m.role = 'user'
             ORDER BY m."createdAt" LIMIT 1) AS title
     FROM conversations c
     WHERE c."userId" = $1
     ORDER BY c."updatedAt" DESC`,
    [session.user.id]
  );

  return NextResponse.json({ conversations: rows });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    rows: [conversation],
  } = await pool.query(
    `INSERT INTO conversations ("userId") VALUES ($1) RETURNING id, status, "createdAt"`,
    [session.user.id]
  );

  return NextResponse.json({ conversation }, { status: 201 });
}

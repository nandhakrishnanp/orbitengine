import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { listAccessibleRepos } from "@/lib/github";
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
    `SELECT id, status, "attachedRepository", "sandboxId", "createdAt" FROM conversations WHERE id = $1 AND "userId" = $2`,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const attachedRepository = String(body.attachedRepository ?? "").trim();
  if (!attachedRepository) {
    return NextResponse.json({ error: "attachedRepository required" }, { status: 400 });
  }

  const ownership = await pool.query(
    `SELECT id FROM conversations WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );
  if (ownership.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const repos = await listAccessibleRepos(session.user.id);
    const allowed = repos.some((repo) => repo.fullName === attachedRepository);
    if (!allowed) {
      return NextResponse.json(
        { error: "Repository is not accessible to your GitHub account" },
        { status: 403 }
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify repository access";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { rows } = await pool.query(
    `UPDATE conversations
     SET "attachedRepository" = $1, "updatedAt" = now()
     WHERE id = $2 AND "userId" = $3
     RETURNING id, status, "attachedRepository", "createdAt"`,
    [attachedRepository, id, session.user.id]
  );

  return NextResponse.json({ conversation: rows[0] });
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
     RETURNING id, status, "attachedRepository", "createdAt"`,
    [id]
  );

  return NextResponse.json({ conversation: rows[0] });
}
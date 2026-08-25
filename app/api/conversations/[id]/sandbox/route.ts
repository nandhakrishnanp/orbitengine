import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { provisionSandbox } from "@/lib/sandbox";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const ownership = await pool.query(
    `SELECT id, status, "sandboxId", "snapshotId"
     FROM conversations WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );
  if (ownership.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const conversation = ownership.rows[0];

  // Reopening a closed conversation restores the workspace from the snapshot
  // captured at close time (ADR-0016). The sandbox handle itself is cleared;
  // the snapshot ID is kept until the next close replaces it.
  if (conversation.status === "closed") {
    await pool.query(
      `UPDATE conversations SET status = 'open', "sandboxId" = NULL, "updatedAt" = now()
       WHERE id = $1`,
      [id]
    );
  }

  if (conversation.sandboxId && conversation.status !== "closed") {
    return NextResponse.json({
      conversation: { ...conversation, status: "open" },
      sandboxStatus: "ready",
    });
  }

  const sandboxId = await provisionSandbox({
    conversationId: id,
    userId: session.user.id,
    snapshotId: conversation.snapshotId,
  });

  const { rows } = await pool.query(
    `UPDATE conversations
     SET "sandboxId" = $1, status = 'open', "updatedAt" = now()
     WHERE id = $2
     RETURNING id, status, "sandboxId", "createdAt"`,
    [sandboxId, id]
  );

  return NextResponse.json({
    conversation: rows[0],
    sandboxStatus: "ready",
  });
}

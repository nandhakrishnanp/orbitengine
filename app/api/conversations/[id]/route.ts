import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { listConversationMessages } from "@/lib/messages";
import { PROVIDERS, MODES } from "@/lib/settings";
import { destroySandbox, destroySnapshot, closeConversationSandbox } from "@/lib/sandbox";

const patchSchema = z
  .object({
    provider: z.enum(PROVIDERS).nullable().optional(),
    model: z.string().min(1).nullable().optional(),
    mode: z.enum(MODES).optional(),
    status: z.enum(["closed"]).optional(),
  })
  .strict();

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
    `SELECT id, status, "sandboxId", provider, model, mode, "createdAt" FROM conversations WHERE id = $1 AND "userId" = $2`,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const sets: string[] = [];
  const values: unknown[] = [id, session.user.id];
  if (parsed.data.provider !== undefined) {
    values.push(parsed.data.provider);
    sets.push(`provider = $${values.length}`);
  }
  if (parsed.data.model !== undefined) {
    values.push(parsed.data.model);
    sets.push(`model = $${values.length}`);
  }
  if (parsed.data.mode !== undefined) {
    values.push(parsed.data.mode);
    sets.push(`mode = $${values.length}`);
  }

  // Closing snapshots the sandbox filesystem so a later reopen can restore
  // the workspace (ADR-0016). The new snapshot replaces any previous one,
  // which is destroyed so it does not linger orphaned in Vercel.
  let previousSnapshotId: string | null = null;
  if (parsed.data.status === "closed") {
    const current = await pool.query(
      `SELECT "snapshotId" FROM conversations WHERE id = $1 AND "userId" = $2`,
      [id, session.user.id]
    );
    previousSnapshotId = current.rows[0]?.snapshotId ?? null;
    const newSnapshotId = await closeConversationSandbox(id);
    sets.push(`status = 'closed'`);
    values.push(newSnapshotId);
    sets.push(`"snapshotId" = COALESCE($${values.length}, "snapshotId")`);
    if (
      newSnapshotId &&
      previousSnapshotId &&
      previousSnapshotId !== newSnapshotId
    ) {
      await destroySnapshot(previousSnapshotId);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE conversations SET ${sets.join(", ")}, "updatedAt" = now()
     WHERE id = $1 AND "userId" = $2
     RETURNING id, status, "sandboxId", provider, model, mode, "createdAt"`,
    values
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ conversation: result.rows[0] });
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
    `SELECT id, "sandboxId", "snapshotId" FROM conversations WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );
  if (ownership.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { sandboxId, snapshotId } = ownership.rows[0];
  console.log(
    `[conversations] DELETE id=${id} dbSandboxId=${sandboxId ?? "null"} dbSnapshotId=${snapshotId ?? "null"}`
  );

  // Destroy the sandbox and any stored snapshot, then permanently delete the
  // conversation and its messages (cascaded via the foreign key).
  await destroySandbox(id);
  if (snapshotId) {
    await destroySnapshot(snapshotId);
  }

  await pool.query(
    `DELETE FROM conversations WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );

  return NextResponse.json({ deleted: true, sandboxId });
}

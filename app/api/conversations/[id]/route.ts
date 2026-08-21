import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { listConversationMessages } from "@/lib/messages";
import { PROVIDERS } from "@/lib/settings";
import { destroySandbox } from "@/lib/sandbox";

const patchSchema = z
  .object({
    provider: z.enum(PROVIDERS).nullable().optional(),
    model: z.string().min(1).nullable().optional(),
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
    `SELECT id, status, "sandboxId", provider, model, "createdAt" FROM conversations WHERE id = $1 AND "userId" = $2`,
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
  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE conversations SET ${sets.join(", ")}, "updatedAt" = now()
     WHERE id = $1 AND "userId" = $2
     RETURNING id, status, "sandboxId", provider, model, "createdAt"`,
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

import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { listConversationTraces } from "@/lib/traces";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const ownership = await pool.query(
    `SELECT id FROM conversations WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );
  if (ownership.rowCount === 0) {
    return new Response("Not found", { status: 404 });
  }

  const runs = await listConversationTraces(id);
  return Response.json({ runs });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { PROVIDERS, MODES } from "@/lib/settings";
import {
  getFactory,
  updateFactory,
  deleteFactory,
} from "@/lib/factories";

const patchSchema = z
  .object({
    labelFilter: z.array(z.string().min(1)).max(20).optional(),
    provider: z.enum(PROVIDERS).nullable().optional(),
    model: z.string().min(1).nullable().optional(),
    mode: z.enum(MODES).optional(),
    checkCommand: z.string().min(1).max(500).nullable().optional(),
    status: z.enum(["active", "paused"]).optional(),
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
  const factory = await getFactory(id, session.user.id);
  if (!factory) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ factory });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id } = await params;
  const factory = await updateFactory(id, session.user.id, parsed.data);
  if (!factory) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ factory });
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
  const deleted = await deleteFactory(id, session.user.id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}

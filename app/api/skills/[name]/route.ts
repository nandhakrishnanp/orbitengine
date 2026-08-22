import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { deleteSkill, getSkillByName, updateSkill } from "@/lib/skills";

const patchSchema = z
  .object({
    content: z.string().min(1).optional(),
    declaredTools: z.array(z.string()).optional(),
  })
  .strict();

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await params;
  const skill = await getSkillByName(session.user.id, name);
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }
  return NextResponse.json({ skill });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid skill payload", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name } = await params;
  try {
    const skill = await updateSkill(session.user.id, name, parsed.data);
    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    return NextResponse.json({ skill });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update skill";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await params;
  const deleted = await deleteSkill(session.user.id, name);
  if (!deleted) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

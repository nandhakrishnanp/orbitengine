import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createSkill, listSkills } from "@/lib/skills";

const createSchema = z.object({
  name: z.string().min(1).max(64),
  content: z.string().min(1),
  declaredTools: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const skills = await listSkills(session.user.id);
  return NextResponse.json({ skills });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid skill payload", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const skill = await createSkill(session.user.id, parsed.data);
    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create skill";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

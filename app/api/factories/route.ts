import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { PROVIDERS, MODES } from "@/lib/settings";
import { createFactory, listFactories } from "@/lib/factories";
import { listAccessibleRepos } from "@/lib/github";

const createSchema = z
  .object({
    repoFullName: z
      .string()
      .regex(/^[^/]+\/[^/]+$/, "repoFullName must be owner/repo"),
    labelFilter: z.array(z.string().min(1)).max(20).optional(),
    provider: z.enum(PROVIDERS).nullable().optional(),
    model: z.string().min(1).nullable().optional(),
    mode: z.enum(MODES).optional(),
    checkCommand: z.string().min(1).max(500).nullable().optional(),
  })
  .strict();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const factories = await listFactories(session.user.id);
  return NextResponse.json({ factories });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Only repos reachable by the user's GitHub App installation can be wired
  // to a factory — otherwise polling would silently fail later.
  let accessible: string[];
  try {
    accessible = (await listAccessibleRepos(userId)).map((r) => r.fullName);
  } catch {
    return NextResponse.json(
      { error: "GitHub App not installed or repositories unavailable" },
      { status: 400 }
    );
  }
  if (!accessible.includes(parsed.data.repoFullName)) {
    return NextResponse.json(
      { error: `Repository ${parsed.data.repoFullName} is not accessible` },
      { status: 400 }
    );
  }

  try {
    const factory = await createFactory({
      userId,
      repoFullName: parsed.data.repoFullName,
      labelFilter: parsed.data.labelFilter,
      provider: parsed.data.provider ?? null,
      model: parsed.data.model ?? null,
      mode: parsed.data.mode,
      checkCommand: parsed.data.checkCommand ?? null,
    });
    return NextResponse.json({ factory }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "A factory for this repository already exists" },
        { status: 409 }
      );
    }
    throw error;
  }
}

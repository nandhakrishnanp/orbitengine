import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  getSettings,
  listProviderKeys,
  updateSettings,
  PROVIDERS,
} from "@/lib/settings";

const modelSchema = z.object({
  provider: z.enum(PROVIDERS),
  id: z.string().min(1),
});

const patchSchema = z
  .object({
    model: modelSchema.optional(),
    mode: z.enum(["plan", "build"]).optional(),
    loop: z
      .object({
        maxSteps: z.number().int().min(1).max(200).optional(),
        maxRetries: z.number().int().min(0).max(10).optional(),
      })
      .optional(),
  })
  .strict();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [settings, keys] = await Promise.all([
    getSettings(session.user.id),
    listProviderKeys(session.user.id),
  ]);
  return NextResponse.json({ settings, keys });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings payload", details: parsed.error.issues },
      { status: 400 }
    );
  }

  await updateSettings(session.user.id, parsed.data);
  const settings = await getSettings(session.user.id);
  return NextResponse.json({ settings });
}

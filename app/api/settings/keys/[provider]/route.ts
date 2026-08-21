import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  PROVIDERS,
  removeProviderKey,
  setProviderKey,
} from "@/lib/settings";

const bodySchema = z.object({ key: z.string().min(1) }).strict();

type Params = { params: Promise<{ provider: string }> };

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { provider } = await params;
  if (!PROVIDERS.includes(provider as never)) {
    return NextResponse.json(
      { error: `Unknown provider. Supported: ${PROVIDERS.join(", ")}` },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Expected body { key: string }" },
      { status: 400 }
    );
  }

  const meta = await setProviderKey(
    session.user.id,
    provider as (typeof PROVIDERS)[number],
    parsed.data.key
  );
  return NextResponse.json({ key: meta });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { provider } = await params;
  if (!PROVIDERS.includes(provider as never)) {
    return NextResponse.json(
      { error: `Unknown provider. Supported: ${PROVIDERS.join(", ")}` },
      { status: 404 }
    );
  }

  const removed = await removeProviderKey(
    session.user.id,
    provider as (typeof PROVIDERS)[number]
  );
  if (!removed) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

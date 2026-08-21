import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listProviderModels } from "@/lib/ai";
import { PROVIDERS, getProviderKey } from "@/lib/settings";

type Params = { params: Promise<{ provider: string }> };

export async function GET(_request: Request, { params }: Params) {
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

  const apiKey = await getProviderKey(
    session.user.id,
    provider as (typeof PROVIDERS)[number]
  );
  if (!apiKey) {
    return NextResponse.json({ error: "No key configured" }, { status: 404 });
  }

  try {
    const models = await listProviderModels(
      provider as (typeof PROVIDERS)[number],
      apiKey
    );
    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch models",
      },
      { status: 502 }
    );
  }
}

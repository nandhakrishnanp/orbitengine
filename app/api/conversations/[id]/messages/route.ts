import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveUserMessage, saveAssistantMessage } from "@/lib/messages";
import type { UIMessage } from "ai";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { role = "user", content, parts } = body as {
    role?: "user" | "assistant";
    content?: string;
    parts?: UIMessage["parts"];
  };

  const trimmed = String(content ?? "").trim();
  if (!trimmed && !parts?.length) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  if (role === "assistant") {
    const message = await saveAssistantMessage(id, session.user.id, {
      content: trimmed,
      parts: parts ?? [],
    });
    if (!message) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ message }, { status: 201 });
  }

  const message = await saveUserMessage(id, session.user.id, trimmed);
  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ message }, { status: 201 });
}

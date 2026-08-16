import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listAccessibleRepos } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repos = await listAccessibleRepos(session.user.id);
    return NextResponse.json({ repos });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list repositories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
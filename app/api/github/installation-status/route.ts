import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getGitHubAppInstallUrl,
  isGitHubAppInstalled,
} from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const installed = await isGitHubAppInstalled(session.user.id);
    if (installed) {
      return NextResponse.json({ installed, installUrl: null });
    }

    let installUrl: string | null = null;
    try {
      installUrl = await getGitHubAppInstallUrl();
    } catch {
      installUrl = null;
    }
    return NextResponse.json({ installed, installUrl });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to check GitHub App installation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

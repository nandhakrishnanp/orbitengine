import { NextResponse } from "next/server";
import { pollOnce } from "@/lib/factory-poll";

// Prod polling entry point (docs/factory.md §4). Vercel Cron hits this route
// with `Authorization: Bearer $CRON_SECRET`; execution itself lives in the
// worker — this only enqueues queued runs.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await pollOnce();
  const created = results.reduce((n, r) => n + r.createdRuns, 0);
  return NextResponse.json({ polled: results.length, created, results });
}

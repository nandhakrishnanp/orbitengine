import { Sandbox } from "@vercel/sandbox";
import { getInstallationTokenForUser } from "@/lib/github";

export type SandboxStatus = "provisioning" | "ready" | "closed";

export function sandboxName(conversationId: string): string {
  return `conv-${conversationId.replace(/-/g, "").slice(0, 26)}`;
}

export async function provisionSandbox({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}): Promise<string> {
  const token = await getInstallationTokenForUser(userId);
  const name = sandboxName(conversationId);

  const sandbox = await Sandbox.getOrCreate({
    name,
    persistent: true,
    env: {
      GITHUB_TOKEN: token,
    },
  });

  return sandbox.name;
}

export async function destroySandbox(conversationId: string): Promise<void> {
  const name = sandboxName(conversationId);
  try {
    const sandbox = await Sandbox.get({ name });
    await sandbox.delete();
  } catch {
    // Already gone — nothing to destroy.
  }
}

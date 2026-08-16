import { Sandbox } from "@vercel/sandbox";
import { getInstallationTokenForUser } from "@/lib/github";

export type SandboxStatus = "provisioning" | "ready" | "closed";

export function sandboxName(conversationId: string): string {
  return `conv-${conversationId.replace(/-/g, "").slice(0, 26)}`;
}

export async function provisionSandbox({
  conversationId,
  userId,
  attachedRepository,
}: {
  conversationId: string;
  userId: string;
  attachedRepository: string | null;
}): Promise<string> {
  const token = await getInstallationTokenForUser(userId);
  const name = sandboxName(conversationId);

  const sandbox = await Sandbox.getOrCreate({
    name,
    persistent: true,
    env: {
      GITHUB_TOKEN: token,
      ...(attachedRepository
        ? {
            ATTACHED_REPOSITORY: attachedRepository,
            GITHUB_REPOSITORY_URL: `https://github.com/${attachedRepository}.git`,
          }
        : {}),
    },
    ...(attachedRepository
      ? {
          source: {
            type: "git" as const,
            url: `https://github.com/${attachedRepository}.git`,
            username: "x-access-token",
            password: token,
          },
        }
      : {}),
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
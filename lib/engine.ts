import { Sandbox } from "@vercel/sandbox";
import { tool } from "ai";
import { z } from "zod";

export function engineTools(sandbox: Sandbox) {
  return {
    run_command: tool({
      description:
        "Run a shell command inside the sandbox. Returns stdout, stderr, and exit code.",
      inputSchema: z.object({
        command: z.string().describe("The shell command to execute"),
      }),
      execute: async ({ command }) => {
        const result = await sandbox.runCommand("bash", ["-c", command], {
          timeoutMs: 120_000,
        });
        const stdout = await result.stdout();
        const stderr = await result.stderr();
        return {
          exitCode: result.exitCode,
          stdout: stdout.slice(0, 50_000),
          stderr: stderr.slice(0, 50_000),
        };
      },
    }),

    read_file: tool({
      description: "Read the contents of a file in the sandbox.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("Absolute or relative path to the file to read"),
      }),
      execute: async ({ path }) => {
        const stream = await sandbox.readFile({ path });
        if (!stream) {
          return { error: `File not found: ${path}` };
        }
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const content = Buffer.concat(chunks).toString("utf8");
        return { content: content.slice(0, 100_000) };
      },
    }),

    write_file: tool({
      description: "Write content to a file in the sandbox.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("Absolute or relative path to the file to write"),
        content: z.string().describe("The content to write to the file"),
      }),
      execute: async ({ path, content }) => {
        await sandbox.writeFiles([{ path, content }]);
        return { success: true, path };
      },
    }),

    list_files: tool({
      description:
        "List files and directories at a given path in the sandbox.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("Directory path to list (default: current directory)"),
      }),
      execute: async ({ path }) => {
        const result = await sandbox.runCommand("ls", ["-la", path]);
        const stdout = await result.stdout();
        return { entries: stdout };
      },
    }),
  };
}

export const SYSTEM_PROMPT = `You are OrbitEngine, an AI coding assistant running inside an isolated cloud sandbox.

You have access to tools that let you interact with the sandbox filesystem and execute commands.

## Cloning repositories

If the user mentions a repository as @owner/repo, clone it immediately:
  git clone https://x-access-token:\${GITHUB_TOKEN}@github.com/owner/repo.git .
The GITHUB_TOKEN environment variable is a GitHub installation token with read/write access to the user's repositories.
After cloning, work with the files normally.

## Working with code

When the user asks you to make changes to code:
1. First read the relevant files to understand the current state
2. Make the necessary edits using write_file
3. Run tests or build commands to verify your changes
4. Explain what you did

Be concise and direct. Focus on the task at hand.
Always verify your changes by running relevant tests or build commands when possible.`;

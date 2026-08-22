import { Sandbox } from "@vercel/sandbox";
import { tool } from "ai";
import { z } from "zod";

const API_BASE = "https://api.github.com";

async function githubApi<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "orbitengine",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`GitHub API ${res.status} for ${path}: ${detail}`);
  }
  return (await res.json()) as T;
}

export function engineTools(sandbox: Sandbox, githubToken: string) {
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

    create_pull_request: tool({
      description:
        "Open a pull request on GitHub. Commit changes to a feature branch, push it, then call this tool to create the PR against the base branch.",
      inputSchema: z.object({
        owner: z.string().describe("Repository owner (e.g. 'octocat')"),
        repo: z.string().describe("Repository name (e.g. 'my-repo')"),
        title: z.string().describe("Pull request title"),
        head: z
          .string()
          .describe("Head branch name (e.g. 'fix/bug') — must be pushed already"),
        base: z
          .string()
          .describe("Base branch to merge into (e.g. 'main')"),
        body: z
          .string()
          .optional()
          .describe("Pull request description in Markdown"),
      }),
      execute: async ({ owner, repo, title, head, base, body }) => {
        const pr = await githubApi<{
          number: number;
          html_url: string;
          title: string;
        }>(
          `/repos/${owner}/${repo}/pulls`,
          githubToken,
          {
            method: "POST",
            body: JSON.stringify({ title, head, base, body: body ?? "" }),
          }
        );
        return {
          number: pr.number,
          url: pr.html_url,
          title: pr.title,
        };
      },
    }),

    create_issue: tool({
      description:
        "Create a GitHub issue on a repository. Use this to record bugs, feature requests, or tasks.",
      inputSchema: z.object({
        owner: z.string().describe("Repository owner (e.g. 'octocat')"),
        repo: z.string().describe("Repository name (e.g. 'my-repo')"),
        title: z.string().describe("Issue title"),
        body: z
          .string()
          .optional()
          .describe("Issue description in Markdown"),
        labels: z
          .array(z.string())
          .optional()
          .describe("Labels to apply (e.g. ['bug', 'enhancement'])"),
      }),
      execute: async ({ owner, repo, title, body, labels }) => {
        const issue = await githubApi<{
          number: number;
          html_url: string;
          title: string;
        }>(
          `/repos/${owner}/${repo}/issues`,
          githubToken,
          {
            method: "POST",
            body: JSON.stringify({ title, body: body ?? "", labels: labels ?? [] }),
          }
        );
        return {
          number: issue.number,
          url: issue.html_url,
          title: issue.title,
        };
      },
    }),

    create_repository: tool({
      description:
        "Create a new GitHub repository. Use this to bootstrap a new project.",
      inputSchema: z.object({
        name: z.string().describe("Repository name (e.g. 'my-new-project')"),
        description: z
          .string()
          .optional()
          .describe("Repository description"),
        private: z
          .boolean()
          .optional()
          .describe("Whether the repo should be private (default: false)"),
      }),
      execute: async ({ name, description, private: isPrivate }) => {
        const repo = await githubApi<{
          full_name: string;
          html_url: string;
          clone_url: string;
          name: string;
          owner: { login: string };
        }>(
          "/user/repos",
          githubToken,
          {
            method: "POST",
            body: JSON.stringify({
              name,
              description: description ?? "",
              private: isPrivate ?? false,
              auto_init: false,
            }),
          }
        );
        return {
          fullName: repo.full_name,
          url: repo.html_url,
          cloneUrl: repo.clone_url,
          owner: repo.owner.login,
          name: repo.name,
        };
      },
    }),
  };
}

export const SYSTEM_PROMPT = `You are OrbitEngine, an AI coding assistant running inside an isolated cloud sandbox.

You have access to tools that let you interact with the sandbox filesystem, execute commands, and interact with GitHub.

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

## Opening pull requests

When your changes are ready and verified:
1. Create a feature branch: git checkout -b <branch-name>
2. Stage and commit your changes: git add -A && git commit -m "<description>"
3. Push the branch: git push origin <branch-name>
4. Use the create_pull_request tool to open the PR against the base branch
5. Share the PR link with the user

Never push directly to main or master. Always use a feature branch.

## Creating issues

If the user asks to record a bug, feature request, or task, use the create_issue tool.
Include a clear title and detailed description. Add labels if appropriate.

## Bootstrapping new projects

If the user asks to create a new project from scratch:
1. Use create_repository to create the repo on GitHub
2. Clone it into the sandbox
3. Build the project scaffold
4. Commit and push the initial code

Be concise and direct. Focus on the task at hand.
Always verify your changes by running relevant tests or build commands when possible.`;

export const PLAN_MODE_PROMPT = `## Plan mode (active)

You are currently in Plan mode, which is strictly read-only:
- You may read files and list directories to understand the codebase.
- You cannot write files or run commands that modify state.
- You cannot open pull requests, create issues, or create repositories.

Analyse the code, answer questions, and produce a clear plan: what files
would change, how, and in what order. The user will switch to Build mode
to have the changes applied.`;

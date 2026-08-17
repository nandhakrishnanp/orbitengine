"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BundledLanguage } from "shiki";
import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { CodeBlock } from "@/components/ai-elements/code-block";
import {
  FileTree,
  FileTreeFile,
  FileTreeFolder,
} from "@/components/ai-elements/file-tree";
import { Terminal } from "@/components/ai-elements/terminal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  MonitorIcon,
  RefreshCwIcon,
} from "lucide-react";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  children?: TreeNode[];
}

interface TreeData {
  cwd: string;
  entries: TreeNode[];
}

interface FileData {
  path: string;
  name: string;
  size: number;
  content?: string;
  binary?: boolean;
  tooLarge?: boolean;
}

const LANGUAGE_MAP: Record<string, BundledLanguage> = {
  ts: "typescript",
  tsx: "tsx",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  md: "markdown",
  mdx: "mdx",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  rb: "ruby",
  php: "php",
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  sql: "sql",
  xml: "xml",
  svg: "xml",
  vue: "vue",
  svelte: "svelte",
  dockerfile: "dockerfile",
};

function languageFor(name: string): BundledLanguage {
  const base = name.toLowerCase();
  if (base === "dockerfile") return "dockerfile";
  const ext = base.includes(".") ? (base.split(".").pop() ?? "") : "";
  return LANGUAGE_MAP[ext] ?? "text";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function flattenTree(entries: TreeNode[]): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  const visit = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      map.set(node.path, node);
      if (node.children) visit(node.children);
    }
  };
  visit(entries);
  return map;
}

function TreeNodes({ nodes }: { nodes: TreeNode[] }) {
  return (
    <>
      {nodes.map((node) =>
        node.type === "folder" ? (
          <FileTreeFolder key={node.path} name={node.name} path={node.path}>
            {node.children && node.children.length > 0 ? (
              <TreeNodes nodes={node.children} />
            ) : null}
          </FileTreeFolder>
        ) : (
          <FileTreeFile key={node.path} name={node.name} path={node.path} />
        )
      )}
    </>
  );
}

export default function MonitorPanel({
  conversationId,
  status,
  sandboxId,
}: {
  conversationId: string;
  status: string;
  sandboxId: string | null;
}) {
  const router = useRouter();
  const [tree, setTree] = useState<TreeData | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [file, setFile] = useState<FileData | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [reopening, setReopening] = useState(false);

  const nodeMap = useMemo(
    () => (tree ? flattenTree(tree.entries) : new Map<string, TreeNode>()),
    [tree]
  );

  const defaultExpanded = useMemo(() => {
    if (!tree) return new Set<string>();
    return new Set(
      tree.entries.filter((e) => e.type === "folder").map((e) => e.path)
    );
  }, [tree]);

  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    setTreeError(null);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/monitor/tree`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load files");
      }
      setTree((await res.json()) as TreeData);
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setTreeLoading(false);
    }
  }, [conversationId]);

  const loadFile = useCallback(
    async (path: string) => {
      setFileLoading(true);
      setFileError(null);
      setFile(null);
      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/monitor/file?path=${encodeURIComponent(path)}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to read file");
        }
        setFile((await res.json()) as FileData);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Failed to read file");
      } finally {
        setFileLoading(false);
      }
    },
    [conversationId]
  );

  useEffect(() => {
    if (!sandboxId) return;
    const timer = setTimeout(() => void loadTree(), 0);
    return () => clearTimeout(timer);
  }, [sandboxId, loadTree]);

  const handleSelect = useCallback(
    (path: string) => {
      setSelectedPath(path);
      const node = nodeMap.get(path);
      if (node?.type === "file") void loadFile(path);
    },
    [nodeMap, loadFile]
  );

  const appendOutput = useCallback((chunk: string) => {
    setTerminalOutput((prev) => prev + chunk);
  }, []);

  const runCommand = useCallback(async () => {
    const command = commandInput.trim();
    if (!command || isStreaming) return;
    setIsStreaming(true);
    appendOutput(`$ ${command}\n`);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/monitor/command`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command }),
        }
      );
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        appendOutput(
          `\x1b[31m${data.error ?? "Failed to run command"}\x1b[0m\n`
        );
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const lines = frame.split("\n");
          const event =
            lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "message";
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          let payload: {
            stream?: string;
            data?: string;
            exitCode?: number;
            message?: string;
          };
          try {
            payload = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }
          if (event === "output" && typeof payload.data === "string") {
            if (payload.stream === "stderr") {
              appendOutput(`\x1b[31m${payload.data}\x1b[0m`);
            } else {
              appendOutput(payload.data);
            }
          } else if (event === "exit") {
            appendOutput(`\n[exit code ${payload.exitCode ?? "?"}]\n`);
          } else if (event === "error") {
            appendOutput(
              `\x1b[31m${payload.message ?? "Command failed"}\x1b[0m\n`
            );
          }
        }
      }
    } catch (err) {
      appendOutput(
        `\x1b[31m${err instanceof Error ? err.message : "Command failed"}\x1b[0m\n`
      );
    } finally {
      setIsStreaming(false);
    }
  }, [appendOutput, commandInput, conversationId, isStreaming]);

  const copyFile = useCallback(async () => {
    if (!file?.content) return;
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — ignore.
    }
  }, [file]);

  const downloadFile = useCallback(() => {
    if (!file?.content) return;
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [file]);

  const reopen = useCallback(async () => {
    setReopening(true);
    const res = await fetch(`/api/conversations/${conversationId}/sandbox`, {
      method: "POST",
    });
    setReopening(false);
    if (res.ok) router.refresh();
  }, [conversationId, router]);

  if (!sandboxId) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <MonitorHeader conversationId={conversationId} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <MonitorIcon className="size-8 text-zinc-400" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {status === "closed"
              ? "The sandbox for this conversation is closed."
              : "The sandbox is still provisioning…"}
          </p>
          {status === "closed" && (
            <Button onClick={reopen} disabled={reopening} size="sm">
              {reopening ? "Reopening…" : "Reopen sandbox"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MonitorHeader conversationId={conversationId} />

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="flex w-72 shrink-0 flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Files
            </span>
            <Button
              onClick={loadTree}
              disabled={treeLoading}
              size="icon"
              variant="ghost"
              className="size-7"
            >
              <RefreshCwIcon
                className={cn("size-3.5", treeLoading && "animate-spin")}
              />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {treeError ? (
              <p className="text-sm text-red-500">{treeError}</p>
            ) : treeLoading && !tree ? (
              <p className="p-2 text-sm text-zinc-500 dark:text-zinc-400">
                Loading files…
              </p>
            ) : tree && tree.entries.length === 0 ? (
              <p className="p-2 text-sm text-zinc-500 dark:text-zinc-400">
                Empty workspace — attach a repository with @owner/repo in the
                chat.
              </p>
            ) : tree ? (
              <FileTree
                defaultExpanded={defaultExpanded}
                onSelect={handleSelect}
                selectedPath={selectedPath ?? undefined}
              >
                <TreeNodes nodes={tree.entries} />
              </FileTree>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <Artifact className="min-h-0 flex-1">
            <ArtifactHeader>
              <div className="min-w-0">
                <ArtifactTitle className="truncate">
                  {file?.name ?? "No file selected"}
                </ArtifactTitle>
                <ArtifactDescription className="truncate">
                  {file
                    ? `${file.path} · ${formatSize(file.size)}`
                    : "Pick a file from the tree"}
                </ArtifactDescription>
              </div>
              {file?.content != null && (
                <ArtifactActions>
                  <ArtifactAction
                    icon={copied ? CheckIcon : CopyIcon}
                    label="Copy"
                    tooltip="Copy file contents"
                    onClick={copyFile}
                  />
                  <ArtifactAction
                    icon={DownloadIcon}
                    label="Download"
                    tooltip="Download file"
                    onClick={downloadFile}
                  />
                </ArtifactActions>
              )}
            </ArtifactHeader>
            <ArtifactContent className="p-0">
              {fileLoading ? (
                <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                  Loading…
                </div>
              ) : fileError ? (
                <div className="p-4 text-sm text-red-500">{fileError}</div>
              ) : file?.tooLarge ? (
                <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                  File is too large to preview ({formatSize(file.size)}).
                </div>
              ) : file?.binary ? (
                <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                  Binary file — no preview available.
                </div>
              ) : file?.content != null ? (
                <CodeBlock
                  className="border-none"
                  code={file.content}
                  language={languageFor(file.name)}
                  showLineNumbers
                />
              ) : (
                <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                  Select a file to view its contents.
                </div>
              )}
            </ArtifactContent>
          </Artifact>

          <div className="flex shrink-0 flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Terminal
            </span>
            <Terminal
              isStreaming={isStreaming}
              onClear={() => setTerminalOutput("")}
              output={terminalOutput}
            />
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void runCommand();
              }}
            >
              <input
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder="Run a command in the sandbox (e.g. npm test)"
                disabled={isStreaming}
                className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 font-mono text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700"
              />
              <Button
                type="submit"
                disabled={isStreaming || !commandInput.trim()}
              >
                {isStreaming ? "Running…" : "Run"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonitorHeader({ conversationId }: { conversationId: string }) {
  return (
    <header className="flex items-center gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
      <Link
        href={`/conversations/${conversationId}`}
        className="flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeftIcon className="size-4" />
        Chat
      </Link>
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        <MonitorIcon className="size-4" />
        Sandbox monitor
      </span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {conversationId.slice(0, 8)}
      </span>
    </header>
  );
}

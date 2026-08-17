"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { signIn } from "next-auth/react";
import {
  ArrowRight,
  Boxes,
  Braces,
  ChevronDown,
  Cog,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitFork,
  GitPullRequest,
  ListTree,
  Lock,
  Monitor,
  Orbit,
  Rocket,
  Shield,
  Sparkles,
  SquareTerminal,
  Zap,
  type LucideIcon,
} from "lucide-react";

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}

function GlowOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="absolute top-1/3 -left-40 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      <div className="absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-[120px]" />
    </div>
  );
}

function Navbar() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl"
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
            <Orbit className="size-5" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            OrbitEngine
          </span>
        </a>
        <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-white">
            How it works
          </a>
          <a href="#monitor" className="transition-colors hover:text-white">
            Monitor
          </a>
          <a href="#faq" className="transition-colors hover:text-white">
            FAQ
          </a>
        </div>
        <button
          onClick={() => signIn("github", { callbackUrl: "/conversations" })}
          className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-transform hover:scale-[1.03]"
        >
          <GitFork className="size-4" />
          Sign in
        </button>
      </nav>
    </motion.header>
  );
}

function HeroEditor({ inView }: { inView: boolean }) {
  return (
    <div className="relative">
      <div className="absolute -inset-8 rounded-3xl bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.9, delay: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="size-3 rounded-full bg-rose-500/70" />
          <span className="size-3 rounded-full bg-amber-500/70" />
          <span className="size-3 rounded-full bg-emerald-500/70" />
          <div className="ml-3 flex items-center gap-1 rounded-md bg-white/5 px-3 py-1 font-mono text-xs text-zinc-400">
            <Braces className="size-3.5 text-zinc-500" />
            index.ts
          </div>
        </div>

        <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">
          <div>
            <span className="text-fuchsia-400">import</span>{" "}
            <span className="text-zinc-500">{"{ "}</span>
            <span className="text-cyan-300">engine</span>
            <span className="text-zinc-500">{" } "}</span>
            <span className="text-fuchsia-400">from</span>{" "}
            <span className="text-emerald-300">&quot;orbit-engine&quot;</span>
            <span className="text-zinc-500">;</span>
          </div>
          <div className="mt-2">
            <span className="text-fuchsia-400">const</span>{" "}
            <span className="text-cyan-300">result</span>{" "}
            <span className="text-zinc-500">=</span>{" "}
            <span className="text-fuchsia-400">await</span>{" "}
            <span className="text-cyan-300">engine</span>
            <span className="text-zinc-500">.</span>
            <span className="text-amber-300">fix</span>
            <span className="text-zinc-500">(</span>
            <span className="text-emerald-300">&quot;flaky test&quot;</span>
            <span className="text-zinc-500">);</span>
          </div>
          <div className="mt-2">
            <span className="text-zinc-500">{"// "}</span>
            <span className="text-zinc-500">sandbox: reads, edits, runs tests</span>
          </div>
          <div className="mt-2">
            <span className="text-fuchsia-400">await</span>{" "}
            <span className="text-cyan-300">engine</span>
            <span className="text-zinc-500">.</span>
            <span className="text-amber-300">openPullRequest</span>
            <span className="text-zinc-500">();</span>
          </div>
        </pre>

        <div className="flex items-center gap-2 border-t border-white/10 bg-black/40 px-4 py-2.5 font-mono text-xs text-zinc-400">
          <SquareTerminal className="size-3.5 text-zinc-500" />
          <span className="text-emerald-400">$</span>
          <span>npm test</span>
          <span className="ml-auto hidden text-zinc-600 sm:inline">
            ✓ 24 passed · 1.2s
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function Hero() {
  const ref = useRef(null);
  const iv = useInView(ref, { once: true });

  return (
    <section
      ref={ref}
      className="relative flex min-h-screen items-center overflow-hidden px-6 pt-16"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-2">
        <div className="max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={iv ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300"
          >
            <Sparkles className="size-3.5 text-cyan-400" />
            A coding engine beside your chat
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={iv ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
          >
            Chat with an engine that
            <span className="block bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
              ships your code.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={iv ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 text-lg leading-relaxed text-zinc-400"
          >
            Link your GitHub, attach a repository, and watch an isolated
            sandbox read your code, make edits, run tests, open PRs, and push
            fixes — all from one conversation.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={iv ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-col items-start gap-4 sm:flex-row"
          >
            <button
              onClick={() => signIn("github", { callbackUrl: "/conversations" })}
              className="group flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-transform hover:scale-[1.03]"
            >
              <GitFork className="size-4" />
              Sign in with GitHub
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <a
              href="#how"
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              See how it works
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={iv ? { opacity: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-zinc-500"
          >
            <span className="flex items-center gap-1.5">
              <Shield className="size-4 text-emerald-400" /> Ephemeral sandbox
            </span>
            <span className="flex items-center gap-1.5">
              <GitPullRequest className="size-4 text-indigo-400" /> PRs &amp;
              issues
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="size-4 text-amber-400" /> Live streaming
            </span>
          </motion.div>
        </div>

        <HeroEditor inView={iv} />
      </div>
    </section>
  );
}

const features = [
  {
    icon: Boxes,
    title: "Isolated sandbox",
    desc: "Every conversation runs in its own ephemeral microVM — filesystem, execution, and tests. Nothing is ever shared between loops.",
    accent: "from-indigo-500 to-violet-500",
  },
  {
    icon: GitBranch,
    title: "Two-way GitHub",
    desc: "The engine reads and writes your repositories, PRs, and issues. Link once, work across all of them.",
    accent: "from-fuchsia-500 to-pink-500",
  },
  {
    icon: FileCode2,
    title: "Edits real code",
    desc: "Bootstrap new projects, read and write files, run tests, and push fixes — executed in the cloud, not on your machine.",
    accent: "from-cyan-500 to-sky-500",
  },
  {
    icon: Zap,
    title: "Streaming responses",
    desc: "Watch the engine reason, call tools, and respond in real time with collapsible reasoning and tool call cards.",
    accent: "from-amber-500 to-orange-500",
  },
  {
    icon: Monitor,
    title: "Sandbox monitor",
    desc: "Browse the file tree, inspect files with syntax highlighting, and run commands with live output — right in the browser.",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    icon: GitPullRequest,
    title: "Ships to GitHub",
    desc: "Create pull requests and issues directly from the conversation and push changes to a branch when you're ready.",
    accent: "from-rose-500 to-red-500",
  },
];

function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-6 py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-fuchsia-400">
          Features
        </p>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Everything your workflow needs
        </h2>
        <p className="mt-4 text-lg text-zinc-400">
          A thin chat surface backed by a cloud engine that does the real work.
        </p>
      </Reveal>

      <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.08}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20">
              <div
                className={`pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-gradient-to-br ${f.accent} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-25`}
              />
              <div
                className={`inline-grid size-11 place-items-center rounded-xl bg-gradient-to-br ${f.accent} text-white shadow-lg`}
              >
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {f.desc}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const steps = [
  {
    num: "01",
    icon: GitFork,
    title: "Link your GitHub",
    desc: "Sign in once and authorize OrbitEngine to access your repositories, PRs, and issues.",
  },
  {
    num: "02",
    icon: FolderGit2,
    title: "Attach a repository",
    desc: "Type @ in chat to attach a repo. The engine wires it into your conversation's sandbox as its working tree.",
  },
  {
    num: "03",
    icon: Rocket,
    title: "Watch the engine work",
    desc: "Describe the change. The engine reads your code, edits it, runs tests, and opens a PR or pushes a fix.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-6xl px-6 py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-fuchsia-400">
          How it works
        </p>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          From idea to shipped in three steps
        </h2>
      </Reveal>

      <div className="relative mt-16 grid gap-6 md:grid-cols-3">
        <div className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent md:block" />
        {steps.map((s, i) => (
          <Reveal key={s.num} delay={i * 0.15}>
            <div className="relative flex flex-col items-start gap-4">
              <div className="relative z-10 grid size-18 place-items-center rounded-2xl border border-white/10 bg-zinc-950 p-4 shadow-xl">
                <s.icon className="size-6 text-fuchsia-400" />
                <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-[10px] font-bold text-white">
                  {s.num}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function MonitorShowcase() {
  return (
    <section id="monitor" className="relative mx-auto max-w-6xl px-6 py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-fuchsia-400">
          Sandbox monitor
        </p>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          See inside your sandbox
        </h2>
        <p className="mt-4 text-lg text-zinc-400">
          A dedicated view into the engine&apos;s workspace — browse files and
          run commands without leaving the browser.
        </p>
      </Reveal>

      <Reveal delay={0.15} className="mt-16">
        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-fuchsia-500/20 to-cyan-500/20 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="size-3 rounded-full bg-rose-500/70" />
              <span className="size-3 rounded-full bg-amber-500/70" />
              <span className="size-3 rounded-full bg-emerald-500/70" />
              <span className="ml-3 font-mono text-xs text-zinc-500">
                /conversations/:id/monitor
              </span>
              <span className="ml-auto flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Sandbox ready
              </span>
            </div>
            <div className="grid md:grid-cols-[220px_1fr]">
              <div className="border-r border-white/10 p-4">
                <p className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500">
                  <ListTree className="size-3.5" /> src
                </p>
                {([
                  ["app/page.tsx", Braces],
                  ["app/api/route.ts", Braces],
                  ["lib/sandbox.ts", Cog],
                  ["components/ui.tsx", Braces],
                  ["tests/engine.test.ts", FileCode2],
                ] as [string, LucideIcon][]).map(([name, Icon], i) => (
                  <div
                    key={name as string}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-mono ${
                      i === 0
                        ? "bg-white/10 text-white"
                        : "text-zinc-400"
                    }`}
                  >
                    <Icon className="size-3.5 text-zinc-500" />
                    {name}
                  </div>
                ))}
              </div>
              <div className="overflow-hidden p-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-mono text-zinc-400">
                    <span className="text-fuchsia-400">import</span>
                    <span>{"{ OrbitEngine }"}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-500">
                    <Lock className="size-3.5" /> private
                  </span>
                </div>
                <pre className="mt-4 overflow-x-auto font-mono text-xs leading-relaxed">
                  <div>
                    <span className="text-fuchsia-400">const</span>{" "}
                    <span className="text-cyan-300">engine</span>{" "}
                    <span className="text-zinc-500">=</span>{" "}
                    <span className="text-amber-300">new</span>{" "}
                    <span className="text-emerald-300">OrbitEngine</span>
                    <span className="text-zinc-500">(</span>
                    <span className="text-zinc-500">)</span>
                    <span className="text-zinc-500">;</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-cyan-300">engine</span>
                    <span className="text-zinc-500">.</span>
                    <span className="text-emerald-300">attach</span>
                    <span className="text-zinc-500">(</span>
                    <span className="text-emerald-300">&quot;@you/repo&quot;</span>
                    <span className="text-zinc-500">)</span>
                    <span className="text-zinc-500">;</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-cyan-300">engine</span>
                    <span className="text-zinc-500">.</span>
                    <span className="text-emerald-300">fix</span>
                    <span className="text-zinc-500">(</span>
                    <span className="text-emerald-300">&quot;flaky test&quot;</span>
                    <span className="text-zinc-500">)</span>
                    <span className="text-zinc-500">;</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-cyan-300">engine</span>
                    <span className="text-zinc-500">.</span>
                    <span className="text-emerald-300">openPR</span>
                    <span className="text-zinc-500">();</span>
                  </div>
                </pre>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5 font-mono text-xs text-zinc-400">
              <SquareTerminal className="size-3.5 text-zinc-500" />
              <span className="text-emerald-400">$</span>
              <span>npm test -- --watch</span>
              <span className="ml-2 hidden text-zinc-600 sm:inline">
                ✓ 24 passed · 1.2s
              </span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

const stats = [
  { value: "Isolated", label: "per-conversation sandboxes" },
  { value: "2-way", label: "GitHub integration" },
  { value: "Live", label: "streaming responses" },
  { value: "Cloud", label: "execution, always" },
];

function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-3xl font-semibold text-transparent">
                {s.value}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{s.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const faqs = [
  {
    q: "How does the sandbox work?",
    a: "Each conversation gets its own ephemeral, isolated sandbox (a Firecracker microVM) with its own filesystem and execution environment. The engine does all work there — nothing ever touches your machine.",
  },
  {
    q: "What can the engine do with my GitHub?",
    a: "It reads and writes your repositories, PRs, and issues: editing code, running tests, bootstrapping new projects, opening pull requests, and pushing fixes — all with your authorization.",
  },
  {
    q: "Is my code safe?",
    a: "Yes. Sandboxes are isolated per conversation and never shared. The engine only touches the repository you attach, and all cloud execution stays inside your private sandbox.",
  },
  {
    q: "Can I inspect what the engine is doing?",
    a: "Absolutely. The sandbox monitor lets you browse the file tree, view files with syntax highlighting, and run commands with live output — full visibility into the workspace.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-28">
      <Reveal className="text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-fuchsia-400">
          FAQ
        </p>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight">
          Questions, answered
        </h2>
      </Reveal>
      <div className="mt-12 space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={f.q} delay={i * 0.06}>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                >
                  <span className="font-medium">{f.q}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-zinc-500 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-5 text-sm leading-relaxed text-zinc-400">
                    {f.a}
                  </p>
                </motion.div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/20 via-fuchsia-600/10 to-cyan-500/20 px-8 py-20 text-center">
          <GlowOrbs />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Put an engine beside your chat.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-300">
              Link GitHub, attach a repo, and let OrbitEngine ship the changes
              you describe.
            </p>
            <button
              onClick={() =>
                signIn("github", { callbackUrl: "/conversations" })
              }
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              <GitFork className="size-4" />
              Sign in with GitHub
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-12 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
            <Orbit className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            OrbitEngine
          </span>
        </div>
        <p className="text-sm text-zinc-500">
          © {new Date().getFullYear()} OrbitEngine. Built with an engine.
        </p>
        <div className="flex items-center gap-6 text-sm text-zinc-500">
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#faq" className="transition-colors hover:text-white">
            FAQ
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <MonitorShowcase />
        <Stats />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

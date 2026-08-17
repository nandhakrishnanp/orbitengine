import { redirect } from "next/navigation";
import { GitFork, Orbit } from "lucide-react";
import { auth, signIn } from "@/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) redirect("/conversations");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <div className="flex items-center gap-3">
        <Orbit className="size-8 text-zinc-500 dark:text-zinc-400" />
        <h1 className="text-3xl font-semibold tracking-tight">
          OrbitEngine
        </h1>
      </div>
      <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
        Sign in with GitHub to attach a repository and work on it with an
        engine.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/conversations" });
        }}
      >
        <button className="flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300">
          <GitFork className="size-4" />
          Sign in with GitHub
        </button>
      </form>
    </main>
  );
}
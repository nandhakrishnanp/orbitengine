import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) redirect("/conversations");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <h1 className="max-w-md text-3xl font-semibold tracking-tight">
        OrbitEngine
      </h1>
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
        <button className="rounded-full bg-zinc-900 px-5 py-2 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300">
          Sign in with GitHub
        </button>
      </form>
    </main>
  );
}
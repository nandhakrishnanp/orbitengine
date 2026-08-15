import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-16">
      {session?.user ? (
        <>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={session.user.image ?? ""}
              alt=""
              className="h-12 w-12 rounded-full"
            />
            <div>
              <h1 className="text-2xl font-semibold">
                {session.user.name ?? session.user.email ?? "Signed in"}
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                {session.user.email}
              </p>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="rounded-full bg-zinc-900 px-5 py-2 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300">
              Sign out
            </button>
          </form>
          <Link
            href="/conversations"
            className="rounded-full border border-zinc-200 px-5 py-2 font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            Conversations
          </Link>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
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
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <button className="rounded-full bg-zinc-900 px-5 py-2 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300">
              Sign in with GitHub
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
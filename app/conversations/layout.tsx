import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiFetch } from "@/lib/api";
import Sidebar from "./sidebar";

export const metadata = { title: "OrbitEngine" };

export default async function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const res = await apiFetch("/api/conversations");
  const { conversations } = (await res.json()) as {
    conversations: Conversation[];
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={session.user} conversations={conversations} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

type Conversation = {
  id: string;
  status: string;
  attachedRepository: string | null;
  createdAt: string;
  updatedAt: string;
  title: string | null;
};
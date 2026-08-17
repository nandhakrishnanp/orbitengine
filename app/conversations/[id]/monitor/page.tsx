import { notFound, redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import MonitorPanel from "./monitor-panel";

export default async function MonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const res = await apiFetch(`/api/conversations/${id}`);
  if (res.status === 401) redirect("/");
  if (res.status === 404) notFound();
  const { conversation } = (await res.json()) as {
    conversation: {
      id: string;
      status: string;
      sandboxId: string | null;
    };
  };

  return (
    <MonitorPanel
      conversationId={conversation.id}
      status={conversation.status}
      sandboxId={conversation.sandboxId}
    />
  );
}

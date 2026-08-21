import { KeyRound } from "lucide-react";
import SettingsClient from "./settings-client";

export default function SettingsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <KeyRound className="size-4 text-zinc-500 dark:text-zinc-400" />
        <h1 className="text-sm font-semibold">Settings</h1>
      </header>
      <SettingsClient />
    </div>
  );
}

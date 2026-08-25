import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listFactories,
  listRuns,
  listRunSteps,
  type Factory,
  type FactoryRun,
  type FactoryRunStep,
} from "@/lib/factories";
import { listFactoryTraces } from "@/lib/traces";
import FactoryDashboard from "./factory-dashboard";

export const metadata = { title: "Factory — OrbitEngine" };

export type RunWithSteps = FactoryRun & { steps: FactoryRunStep[] };

export default async function FactoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const userId = session.user.id;
  const factories = await listFactories(userId);

  const groups = await Promise.all(
    factories.map(async (factory: Factory) => {
      const runs = await listRuns(factory.id, userId);
      const withSteps: RunWithSteps[] = await Promise.all(
        runs.map(async (run) => ({ ...run, steps: await listRunSteps(run.id) }))
      );
      return { factory, runs: withSteps };
    })
  );

  const traces = await listFactoryTraces(userId);

  return (
    <FactoryDashboard
      groups={JSON.parse(JSON.stringify(groups))}
      traces={JSON.parse(JSON.stringify(traces))}
    />
  );
}

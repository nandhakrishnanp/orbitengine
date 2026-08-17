import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LandingPage from "@/components/landing/landing-page";

export default async function Home() {
  const session = await auth();

  if (session?.user) redirect("/conversations");

  return <LandingPage />;
}

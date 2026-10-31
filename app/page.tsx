import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loadSnapshot } from "@/lib/data";

// Only one event for now: go straight to it.
export default function Home() {
  return <Suspense><ToFirstEvent /></Suspense>;
}

async function ToFirstEvent() {
  return redirect(`/events/${(await loadSnapshot()).events[0].slug}`);
}

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loadSnapshot } from "@/lib/data";

// Opens on the first event's brief, where prospecting starts.
export default function Home() {
  return <Suspense><ToFirstEvent /></Suspense>;
}

async function ToFirstEvent() {
  return redirect(`/events/${(await loadSnapshot()).events[0].slug}/brief`);
}

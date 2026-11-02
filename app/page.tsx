import { redirect } from "next/navigation";

// Opens on the Las Vegas Grand Prix brief, where prospecting starts.
export default function Home() {
  redirect("/events/lvgp/brief");
}

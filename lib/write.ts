import { createClient } from "@supabase/supabase-js";
import { revalidateTag, updateTag } from "next/cache";

// For Server Actions and Route Handlers: writes use the service-role key, which stays on the server; pages read with
// the anon key. Returns an error message for the page to show (thrown messages are hidden in production), and on
// success expires the cached snapshot so the change shows at once. updateTag only works in Server Actions, so Route
// Handlers pass expireFromRoute.
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type Db = ReturnType<typeof admin>;

export const expireFromRoute = () => revalidateTag("snapshot", { expire: 0 });

export async function write(fn: (db: Db) => Promise<unknown>, expire: () => void = () => updateTag("snapshot")) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return "Saving needs SUPABASE_SERVICE_ROLE_KEY on the server.";
  try {
    await fn(admin());
    expire();
  } catch (e) {
    return (e as Error).message;
  }
}

export const ok = <T,>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
  return data;
};

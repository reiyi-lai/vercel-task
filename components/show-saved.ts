"use server";

import { updateTag } from "next/cache";

// Shows what an API route just saved. A route can only revalidateTag, which Next applies after the route has answered,
// so a refresh fired the moment it answers can still get the old data. This action expires the snapshot itself with
// updateTag (read-your-own-writes), and Next sends the page back re-rendered with fresh data in the same response.
export async function showSaved() {
  updateTag("snapshot");
}

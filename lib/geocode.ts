// City, state and coordinates for a LinkedIn-style location ("Seattle, Washington, United States", "Greater Seattle Area",
// "Washington DC-Baltimore Area"), via OpenStreetMap's free geocoder. Null when the location names no US city, or when
// the geocoder fails: it allows about one request a second, and a missing city shouldn't block adding a contact.
export async function geocode(location: string | undefined) {
  const q = location
    ?.replace(/, United States$/, "")
    .replace(/^Greater /, "")
    .replace(/(-[^,]+)? (Bay |Metropolitan )?Area$/, "")
    .trim();
  if (!q || q === "United States") return null;
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "us", addressdetails: "1" })}`;
  const res = await fetch(url, { headers: { "User-Agent": "seatbook-prototype" } }).catch(() => null);
  const [hit] = res?.ok ? await res.json() : [];
  if (!hit) return null;
  const a = hit.address;
  return {
    city: a.city ?? a.town ?? a.village ?? a.county ?? q,
    state: a["ISO3166-2-lvl4"]?.replace("US-", "") ?? null,
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
  };
}

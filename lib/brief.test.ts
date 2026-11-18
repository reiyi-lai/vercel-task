import { expect, it } from "vitest";
import { outreachVolume } from "./brief";

it("Outreach volume works back from the guest target", () => {
  // 10 seats at 40% acceptance needs 25 invitations.
  expect(outreachVolume({ target_guests: 10, acceptance_rate: 40 }, 0)).toEqual({ invites: 25, expected: 10 });
  // Guests already confirmed come off the target.
  expect(outreachVolume({ target_guests: 10, acceptance_rate: 40 }, 6).invites).toBe(10);
  expect(outreachVolume({ target_guests: 10, acceptance_rate: 40 }, 12)).toEqual({ invites: 0, expected: 12 });
});

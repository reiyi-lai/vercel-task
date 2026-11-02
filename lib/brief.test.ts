import { expect, it } from "vitest";
import { outreachVolume } from "./brief";

it("Outreach volume works back from the guest target", () => {
  // 10 seats at 40% acceptance needs 25 invitations; at 75% approval, 34 executives to shortlist.
  expect(outreachVolume({ target_guests: 10, acceptance_rate: 40, approval_rate: 75 }, 0)).toEqual({ invites: 25, shortlist: 34, expected: 10 });
  // Guests already confirmed come off the target.
  expect(outreachVolume({ target_guests: 10, acceptance_rate: 40, approval_rate: 75 }, 6).invites).toBe(10);
  expect(outreachVolume({ target_guests: 10, acceptance_rate: 40, approval_rate: 75 }, 12)).toEqual({ invites: 0, shortlist: 0, expected: 12 });
});

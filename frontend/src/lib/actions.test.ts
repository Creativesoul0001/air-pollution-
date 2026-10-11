import {
  ACTION_STATUSES,
  allowedTransitions,
  canTransition,
  isTerminal,
  statusLabel,
  statusTone,
  verificationDelta,
} from "./actions";

describe("action state machine (mirrors backend)", () => {
  it("permits open -> assigned", () => {
    expect(canTransition("open", "assigned")).toBe(true);
  });

  it("forbids open -> closed", () => {
    expect(canTransition("open", "closed")).toBe(false);
  });

  it("forbids reopening a closed action", () => {
    expect(isTerminal("closed")).toBe(true);
    expect(allowedTransitions("closed")).toEqual([]);
  });

  it("allows verification flow in order", () => {
    expect(canTransition("in_progress", "pending_verification")).toBe(true);
    expect(canTransition("pending_verification", "verified")).toBe(true);
    expect(canTransition("verified", "closed")).toBe(true);
  });

  it("exposes all backend statuses", () => {
    expect([...ACTION_STATUSES].sort()).toEqual([
      "assigned",
      "cancelled",
      "closed",
      "in_progress",
      "open",
      "pending_verification",
      "verified",
    ]);
  });
});

describe("status labels", () => {
  it("humanises statuses", () => {
    expect(statusLabel("pending_verification")).toBe("Pending Verification");
    expect(statusLabel("open")).toBe("Open");
  });
  it("maps tones", () => {
    expect(statusTone("closed")).toBe("good");
    expect(statusTone("cancelled")).toBe("veryPoor");
    expect(statusTone("open")).toBe("neutral");
  });
});

describe("verificationDelta", () => {
  it("returns delta only when defensible", () => {
    const r = verificationDelta({ conclusion: "measured_delta", delta: -40, pct_change: -33.33 });
    expect(r.defensible).toBe(true);
    expect(r.delta).toBe(-40);
    expect(r.pct).toBe(-33.33);
  });

  it("withholds delta when evidence is insufficient", () => {
    const r = verificationDelta({ conclusion: "insufficient_evidence", delta: null, pct_change: null });
    expect(r.defensible).toBe(false);
    expect(r.delta).toBeNull();
  });
});

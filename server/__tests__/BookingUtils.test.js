const {
    safeInt,
    isProviderRole,
    resolveNextBookingStatus,
  } = require("../utils/bookingUtils");
  
  describe("safeInt()", () => {
    test("converts numeric string to number", () => {
      expect(safeInt("12")).toBe(12);
    });
    test("keeps number as number", () => {
      expect(safeInt(5)).toBe(5);
    });
    test("returns null for non-numeric string", () => {
      expect(safeInt("abc")).toBeNull();
    });
    test("returns null for NaN", () => {
      expect(safeInt(NaN)).toBeNull();
    });
  });
  describe("isProviderRole()", () => {
    test("returns true for VIDEOGRAPHER", () => {
      expect(isProviderRole("VIDEOGRAPHER")).toBe(true);
    });
    test("returns false for CLIENT", () => {
      expect(isProviderRole("CLIENT")).toBe(false);
    });
    test("returns false for ADMIN", () => {
      expect(isProviderRole("ADMIN")).toBe(false);
    });
    test("returns false for undefined/null", () => {
      expect(isProviderRole(undefined)).toBe(false);
      expect(isProviderRole(null)).toBe(false);
    });
  });
  describe("resolveNextBookingStatus()", () => {
    test("provider can confirm -> confirmed", () => {
      const next = resolveNextBookingStatus("pending", "confirm", false, true);
      expect(next).toBe("confirmed");
    });
    test("provider can decline -> declined", () => {
      const next = resolveNextBookingStatus("pending", "decline", false, true);
      expect(next).toBe("declined");
    });
    test("client can cancel -> canceled", () => {
      const next = resolveNextBookingStatus("pending", "cancel", true, false);
      expect(next).toBe("canceled");
    });
    test("provider can mark done -> done", () => {
      const next = resolveNextBookingStatus("confirmed", "done", false, true);
      expect(next).toBe("done");
    });
  
    test("client cannot confirm", () => {
      const next = resolveNextBookingStatus("pending", "confirm", true, false);
      expect(next).toBeNull();
    });
  
    test("provider cannot cancel (cancel is client-only)", () => {
      const next = resolveNextBookingStatus("pending", "cancel", false, true);
      expect(next).toBeNull();
    });
  
    test("invalid action returns null", () => {
      const next = resolveNextBookingStatus("pending", "xxx", false, true);
      expect(next).toBeNull();
    });
  });
  
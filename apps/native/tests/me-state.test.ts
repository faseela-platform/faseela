import type { MeResponse } from "@faseela/api-types";
import { describe, expect, it } from "vitest";

import { INITIAL_ME_STATE, meReducer, type MeState } from "../lib/me-state";

/**
 * The حسابي tab's `/me` lifecycle as a pure reducer: sign-in starts a load, a
 * response lands or fails, focus refetches without blanking the card, and sign-out
 * clears everything so the previous Member's standing never flashes on re-sign-in.
 */

const me = (id: string): MeResponse => ({
  user: { id, name: "سارة" },
  profileComplete: true,
  progress: { tier: "بذرة", points: 40, nextTier: "نبتة", pointsToNext: 60 },
  completedTaskIds: [],
  followedTrackIds: [],
});

const loadedFor = (id: string): MeState =>
  meReducer(meReducer(INITIAL_ME_STATE, { type: "session", userId: id }), {
    type: "loaded",
    me: me(id),
  });

describe("meReducer", () => {
  it("starts signed out", () => {
    expect(INITIAL_ME_STATE).toEqual({ status: "signed-out" });
  });

  it("starts loading with no card when a session appears", () => {
    expect(meReducer(INITIAL_ME_STATE, { type: "session", userId: "u1" })).toEqual({
      status: "loading",
      userId: "u1",
      me: null,
    });
  });

  it("stores the response as loaded", () => {
    const loading = meReducer(INITIAL_ME_STATE, { type: "session", userId: "u1" });
    expect(meReducer(loading, { type: "loaded", me: me("u1") })).toEqual({
      status: "loaded",
      userId: "u1",
      me: me("u1"),
    });
  });

  it("keeps the failure code so the screen can offer a retry", () => {
    const loading = meReducer(INITIAL_ME_STATE, { type: "session", userId: "u1" });
    expect(meReducer(loading, { type: "failed", code: "network" })).toEqual({
      status: "error",
      userId: "u1",
      code: "network",
      me: null,
    });
  });

  it("refetches on focus without blanking the card already shown", () => {
    expect(meReducer(loadedFor("u1"), { type: "fetch" })).toEqual({
      status: "loading",
      userId: "u1",
      me: me("u1"),
    });
  });

  it("keeps the last good card when a refetch fails", () => {
    const refetching = meReducer(loadedFor("u1"), { type: "fetch" });
    expect(meReducer(refetching, { type: "failed", code: "network" })).toEqual({
      status: "error",
      userId: "u1",
      code: "network",
      me: me("u1"),
    });
  });

  it("leaves the state alone when the same session is re-reported", () => {
    const loaded = loadedFor("u1");
    expect(meReducer(loaded, { type: "session", userId: "u1" })).toBe(loaded);
  });

  it("clears the card when the session ends", () => {
    expect(meReducer(loadedFor("u1"), { type: "session", userId: null })).toEqual({
      status: "signed-out",
    });
  });

  it("drops the previous Member's card when a different user signs in", () => {
    expect(meReducer(loadedFor("u1"), { type: "session", userId: "u2" })).toEqual({
      status: "loading",
      userId: "u2",
      me: null,
    });
  });

  it("ignores a response that lands after sign-out", () => {
    const out = meReducer(loadedFor("u1"), { type: "session", userId: null });
    expect(meReducer(out, { type: "loaded", me: me("u1") })).toEqual({ status: "signed-out" });
    expect(meReducer(out, { type: "failed", code: "network" })).toEqual({ status: "signed-out" });
    expect(meReducer(out, { type: "fetch" })).toEqual({ status: "signed-out" });
  });
});

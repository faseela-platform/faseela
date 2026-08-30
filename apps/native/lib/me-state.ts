import type { MeResponse } from "@faseela/api-types";

/**
 * The حسابي tab's `/me` lifecycle as a pure reducer — importable under plain node.
 *
 * Why a reducer and not `useState<MeResponse | null>`: a failed request used to be
 * indistinguishable from "still loading" (the spinner never ended), a focus refetch
 * would have blanked the card, and a sign-out left the previous Member's standing in
 * state to flash on the next sign-in. Each of those is a transition here, tested.
 */
export type MeState =
  | { status: "signed-out" }
  | { status: "loading"; userId: string; me: MeResponse | null }
  | { status: "loaded"; userId: string; me: MeResponse }
  | { status: "error"; userId: string; code: string; me: MeResponse | null };

export type MeEvent =
  /** The session the auth client reports; `null` when signed out. */
  | { type: "session"; userId: string | null }
  /** A (re)fetch starts — focus or retry. Keeps whatever card is showing. */
  | { type: "fetch" }
  | { type: "loaded"; me: MeResponse }
  | { type: "failed"; code: string };

export const INITIAL_ME_STATE: MeState = { status: "signed-out" };

export function meReducer(state: MeState, event: MeEvent): MeState {
  switch (event.type) {
    case "session": {
      if (event.userId === null) return INITIAL_ME_STATE;
      if (state.status !== "signed-out" && state.userId === event.userId) return state;
      return { status: "loading", userId: event.userId, me: null };
    }
    case "fetch":
      if (state.status === "signed-out") return state;
      return { status: "loading", userId: state.userId, me: state.me };
    case "loaded":
      /** A response landing after sign-out must not resurrect the card. */
      if (state.status === "signed-out") return state;
      return { status: "loaded", userId: state.userId, me: event.me };
    case "failed":
      if (state.status === "signed-out") return state;
      return { status: "error", userId: state.userId, code: event.code, me: state.me };
  }
}

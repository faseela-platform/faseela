import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The OS reduce-motion setting, live. `null` until the OS answers — callers must
 * not start an animation before then (the splash's no-autoplay-then-jump rule,
 * generalized). Updates if the Member flips the setting while the app is open.
 */
export function useReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (!cancelled) setReduced(v);
      })
      .catch(() => {
        if (!cancelled) setReduced(false);
      });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
  return reduced;
}

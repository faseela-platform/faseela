import type { NotificationsResponse } from "@faseela/api-types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useSession } from "../lib/auth-client";
import { authedFetch } from "../lib/authed-api";
import { useTheme } from "../lib/theme-context";
import { space } from "../lib/theme";
import { ScalePressable } from "./pressable";

/**
 * The bell in the tab header (§38). A dot rather than a count: on a phone header the
 * number is unreadable at a glance and the only question it answers — "is there
 * something new" — is answered by the dot alone. Gold, because the dot marks something
 * earned or announced, the identity's colour for that (ADR 0029).
 *
 * Kept in the header instead of a fifth tab so the four-tab layout stays legible on a
 * 393px screen. Refetched whenever the screen regains focus, because there is no push
 * channel yet to tell us sooner.
 */
export function NotificationBell() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: session } = useSession();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      authedFetch<NotificationsResponse>("/notifications").then((r) => {
        if (!cancelled && r.ok) setUnread(r.data.unreadCount);
      });
      return () => {
        cancelled = true;
      };
    }, [session]),
  );

  if (!session) return null;

  return (
    <ScalePressable
      onPress={() => router.push("/ishaarat")}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `الإشعارات، ${unread} جديدة` : "الإشعارات"}
      hitSlop={8}
      style={styles.button}
      scaleTo={0.9}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.ink} />
      {unread > 0 ? (
        <View
          style={[styles.dot, { backgroundColor: colors.accentFill, borderColor: colors.surface }]}
        />
      ) : null}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  /** 44×44: the touch floor, as a circle so the press scale reads as a ripple. */
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: space.sm,
  },
  dot: {
    position: "absolute",
    top: 8,
    /** `end`, not `right`: the header mirrors with the writing direction. */
    end: 9,
    width: 9,
    height: 9,
    borderRadius: 999,
    borderWidth: 1.5,
  },
});

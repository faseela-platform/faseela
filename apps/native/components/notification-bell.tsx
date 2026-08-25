import type { NotificationsResponse } from "@faseela/api-types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useSession } from "../lib/auth-client";
import { authedFetch } from "../lib/authed-api";
import { colors, space } from "../lib/theme";

/**
 * The bell in the tab header (§38). A dot rather than a count: on a phone header the
 * number is unreadable at a glance and the only question it answers — "is there
 * something new" — is answered by the dot alone.
 *
 * Kept in the header instead of a fifth tab so the four-tab layout stays legible on a
 * 393px screen. Refetched whenever the screen regains focus, because there is no push
 * channel yet to tell us sooner.
 */
export function NotificationBell() {
  const router = useRouter();
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
    <Pressable
      onPress={() => router.push("/ishaarat")}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `الإشعارات، ${unread} جديدة` : "الإشعارات"}
      hitSlop={12}
      style={styles.button}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.ink} />
      {unread > 0 ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  dot: {
    position: "absolute",
    top: 2,
    /** `end`, not `right`: the header mirrors with the writing direction. */
    end: space.md,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.brand,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});

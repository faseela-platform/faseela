import { forwardRef } from "react";
import {
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type View,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Press feedback the way the `animate-expo` skill prescribes: the surface scales to
 * 0.97 on press-in and back on release, 120 ms, on the UI thread (Reanimated), never
 * a re-render. Used for every card and button in the app so the whole product has one
 * touch feel. Opacity is left alone — a card that fades under the thumb reads as
 * disabled, one that yields reads as pressed.
 */
export const ScalePressable = forwardRef<View, PressableProps & { scaleTo?: number }>(
  function ScalePressable({ scaleTo = 0.97, onPressIn, onPressOut, style, ...rest }, ref) {
    const scale = useSharedValue(1);
    const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
      <AnimatedPressable
        ref={ref}
        {...rest}
        onPressIn={(e) => {
          scale.value = withTiming(scaleTo, { duration: 120 });
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.value = withTiming(1, { duration: 160 });
          onPressOut?.(e);
        }}
        style={
          typeof style === "function"
            ? (state: PressableStateCallbackType) => [animated, style(state)]
            : [animated, style]
        }
      />
    );
  },
);

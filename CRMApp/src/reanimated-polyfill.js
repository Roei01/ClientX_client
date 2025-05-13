// This file provides polyfills for Reanimated on web

// Work around issues with Reanimated's useAnimatedStyle on web
global._WORKLET = true;

// Fake worklet flag for web - helps with dependency validation
if (typeof window !== "undefined") {
  window._WORKLET = true;
}

export default {};

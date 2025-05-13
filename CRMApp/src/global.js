// Define global variables that React Native on web needs

// Define __DEV__ to match React Native's development mode
global.__DEV__ = process.env.NODE_ENV !== "production";

// Reanimated-specific settings
global._WORKLET = true;
global._frameTimestamp = null;

// Add other React Native globals if needed
if (typeof window !== "undefined") {
  // Ensure these globals are available in the window context
  window.__DEV__ = global.__DEV__;
  window._WORKLET = true;
  window._frameTimestamp = null;
}

export default {};

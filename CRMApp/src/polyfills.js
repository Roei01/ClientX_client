// React Native polyfills for web
if (typeof window !== "undefined") {
  // Define __DEV__ if it doesn't exist
  if (typeof __DEV__ === "undefined") {
    window.__DEV__ = process.env.NODE_ENV !== "production";
  }

  // Other potential polyfills can be added here
}

export default {};

import "./src/polyfills"; // Import general polyfills first
import "./src/reanimated-polyfill"; // Import Reanimated-specific polyfills
import { AppRegistry } from "react-native";
import App from "./src/App";
import appName from "./app.json";
import { createRoot } from "react-dom/client";

const rootTag =
  document.getElementById("root") || document.getElementById("app");
AppRegistry.registerComponent(appName, () => App);
AppRegistry.runApplication(appName, {
  initialProps: {},
  rootTag,
});

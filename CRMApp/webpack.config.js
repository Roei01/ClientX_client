const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

module.exports = {
  mode: "development", // אפשר גם 'production'
  entry: [
    path.resolve(__dirname, "src/global.js"), // Add global definitions first
    path.resolve(__dirname, "index.web.js"),
  ],
  output: {
    filename: "bundle.web.js",
    path: path.resolve(__dirname, "dist"),
  },
  resolve: {
    extensions: [".web.js", ".js", ".jsx", ".json", ".ts", ".tsx"],
    alias: {
      "react-native$": "react-native-web",
      process: "process/browser", // Add process alias
    },
    fallback: {
      "process/browser": require.resolve("process/browser"),
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude:
          /node_modules\/(?!(react-native-vector-icons|@expo\/vector-icons|expo-font|expo-modules-core|@react-native)\/).*/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              "@babel/preset-env",
              "@babel/preset-react",
              "@babel/preset-typescript",
            ],
            plugins: ["react-native-reanimated/plugin"],
          },
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        use: [
          {
            loader: "file-loader",
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        use: [
          {
            loader: "file-loader",
            options: {
              name: "[name].[ext]",
              outputPath: "fonts/",
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public/index.html"),
      filename: "index.html",
    }),
    new webpack.DefinePlugin({
      "process.env": JSON.stringify(process.env),
      __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
      "global.GLOBAL": JSON.stringify(true),
      "global.process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development"
      ),
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development"
      ),
    }),
    // Provide global variables used by React Native
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
  ],
  devServer: {
    static: {
      directory: path.resolve(__dirname, "dist"),
    },
    compress: true,
    port: 3001, // Use 3001 to avoid conflicts
  },
};

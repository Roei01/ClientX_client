const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development', // אפשר גם 'production'
  entry: path.resolve(__dirname, 'index.web.js'),
  output: {
    filename: 'bundle.web.js',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    extensions: ['.web.js', '.js', '.jsx', '.json', '.ts', '.tsx'],
    alias: {
      'react-native$': 'react-native-web',
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/, // טיפול בקובצי JS, JSX, TS, TSX
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react',
              '@babel/preset-typescript'
            ]
          }
        },
      },
      {
        test: /\.(png|jpg|gif|svg)$/, // טיפול בקובצי תמונה
        use: [
          {
            loader: 'file-loader',
            options: {},
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public/index.html'),
      filename: 'index.html',
    }),
  ],
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'dist'),
    },
    compress: true,
    port: 8080,
  },
};

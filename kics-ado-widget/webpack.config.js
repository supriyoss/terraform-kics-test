const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",

  entry: {
    widget: "./src/widget.ts"
  },

  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    clean: true
  },

  resolve: {
    extensions: [".ts", ".js"]
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },

  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/widget.html",
          to: "widget.html"
        },
        {
          from: "src/widget.css",
          to: "widget.css"
        }
      ]
    })
  ]
};
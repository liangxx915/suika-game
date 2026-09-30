// 在同一 Wi-Fi 下供手机试玩；只公开游戏运行所需的三个文件。
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const files = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
  "/game.js": ["game.js", "text/javascript; charset=utf-8"]
};
const port = Number(process.env.PORT) || 8765;

http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const entry = files[pathname];
  if (!entry || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  const [filename, contentType] = entry;
  response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
  if (request.method === "HEAD") { response.end(); return; }
  fs.createReadStream(path.join(__dirname, filename)).pipe(response);
}).listen(port, "0.0.0.0", () => {
  console.log(`Suika game listening on port ${port}`);
});

const express = require("express");
const path = require("path");
const https = require("https");
const app = express();
app.use(express.json());
app.post("/api/generate", (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "ANTHROPIC_API_KEY",
      "anthropic-version": "2023-06-01"
    }
  };
  const request = https.request(options, (response) => {
    let data = "";
    response.on("data", chunk => data += chunk);
    response.on("end", () => {
      try { res.json(JSON.parse(data)); }
      catch(e) { res.status(500).json({error: "Parse error"}); }
    });
  });
  request.on("error", err => res.status(500).json({error: err.message}));
  const len = Buffer.byteLength(body);
  request.setHeader("Content-Length", len);
  request.write(body);
  request.end();
});
app.use(express.static(path.join(__dirname, "public")));
app.use((req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(8080, () => console.log("Volta running on port 8080"));

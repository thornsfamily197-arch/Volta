import { Router } from "express";
import https from "https";
const router = Router();
router.post("/generate", (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "ANTHROPIC_API_KEY_HERE",
      "anthropic-version": "2023-06-01",
      "Content-Length": String(Buffer.byteLength(body))
    }
  };
  const request = https.request(options, (response) => {
    let data = "";
    response.on("data", chunk => { data += chunk; });
    response.on("end", () => {
      try { res.json(JSON.parse(data)); }
      catch(e) { res.status(500).json({error: "Parse error"}); }
    });
  });
  request.on("error", err => res.status(500).json({error: err.message}));
  request.write(body);
  request.end();
});
export default router;
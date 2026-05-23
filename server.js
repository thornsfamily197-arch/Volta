const express = require('express');
const path = require('path');
const https = require('https');
const app = express();
app.use(express.json());

function callAnthropic(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const opts = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const r = https.request(opts, response => {
      let data = '';
      response.on('data', c => data += c);
      response.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error')); }
      });
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system } = req.body;
    const data = await callAnthropic({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: system,
      messages: messages
    });
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(express.static('public'));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(process.env.PORT || 3000, () => console.log('Volta running'));

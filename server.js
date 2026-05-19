const express = require('express');
const path = require('path');
const https = require('https');
const app = express();
app.use(express.json());
app.post('/api/generate', (req, res) => {
  const body = JSON.stringify(req.body);
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
      try { res.json(JSON.parse(data)); }
      catch(e) { res.status(500).json({error: data}); }
    });
  });
  r.on('error', e => res.status(500).json({error: e.message}));
  r.write(body);
  r.end();
});
app.use(express.static('public'));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(process.env.PORT || 3000, () => console.log('Volta running'));

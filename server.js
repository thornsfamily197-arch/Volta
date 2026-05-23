const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');
const app = express();
app.use(express.json());

function httpsRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {headers:{'User-Agent':'Mozilla/5.0 (compatible; Volta/1.0)'}}, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function searchComicPlot(query) {
  try {
    const searchQuery = encodeURIComponent(query + ' comic issue plot summary');
    const wikiUrl = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + searchQuery + '&format=json&srlimit=2';
    const wikiData = JSON.parse(await httpsRequest(wikiUrl));
    const results = wikiData.query.search;
    if (!results || !results.length) return '';
    const pageId = results[0].pageid;
    const pageUrl = 'https://en.wikipedia.org/w/api.php?action=query&pageids=' + pageId + '&prop=extracts&explaintext=true&format=json';
    const pageData = JSON.parse(await httpsRequest(pageUrl));
    const extract = pageData.query.pages[pageId].extract || '';
    return extract.substring(0, 3000);
  } catch(e) {
    return '';
  }
}

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
    const lastMessage = messages[messages.length - 1].content;
    const isComicRequest = messages.length <= 2;
    
    let comicInfo = '';
    if (isComicRequest) {
      comicInfo = await searchComicPlot(lastMessage);
    }
    
    const enhancedSystem = system + (comicInfo ? ' IMPORTANT COMIC INFORMATION FROM RESEARCH: ' + comicInfo + ' Use this accurate information when writing the script.' : '');
    
    const data = await callAnthropic({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: enhancedSystem,
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

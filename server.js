const express = require('express');
const path = require('path');
const https = require('https');
const app = express();
app.use(express.json());

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {headers: {'User-Agent': 'Mozilla/5.0'}}, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function searchComic(arc, issue) {
  const query = encodeURIComponent((arc + ' ' + (issue || '') + ' comic plot summary synopsis').trim());
  const url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + query + '&format=json&srlimit=3';
  try {
    const data = JSON.parse(await httpsGet(url));
    const results = data.query.search;
    if (!results.length) return '';
    const pageId = results[0].pageid;
    const pageUrl = 'https://en.wikipedia.org/w/api.php?action=query&pageids=' + pageId + '&prop=extracts&exintro=true&explaintext=true&format=json';
    const pageData = JSON.parse(await httpsGet(pageUrl));
    const pages = pageData.query.pages;
    const extract = pages[pageId].extract || '';
    return extract.substring(0, 2000);
  } catch(e) {
    return '';
  }
}

app.post('/api/generate', async (req, res) => {
  const { arc, issue, format, pageCount } = req.body;
  
  const comicInfo = await searchComic(arc, issue);
  
  const sys = 'You are a YouTube comic book breakdown narrator in the style of fast dramatic comic YouTube channels. Rules: Open mid-action with no setup. Every sentence is a new event. Use but then and suddenly to drive momentum. Present tense throughout. Raise the stakes every single line. Short punchy sentences that hit like punches. End on a one-line gut punch. No markdown. No headers. No panel numbers. No asterisks. No stage directions. Just raw flowing narration that follows the comic from the very first page to the very last panel by panel page by page in order. The viewer should be able to follow along with the actual comic book as they listen. Write enough for ' + pageCount + ' minute(s) of content.';
  
  const usr = 'Write a YouTube comic breakdown script for ' + arc + (issue ? ' focusing on ' + issue : '') + '.' + (comicInfo ? ' Here is accurate information about this comic to use: ' + comicInfo : '') + ' Follow the story from beginning to end. Make it impossible to stop listening. Format: ' + format;

  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: sys,
    messages: [{role: 'user', content: usr}]
  });

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

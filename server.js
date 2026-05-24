const express = require('express');
const path = require('path');
const https = require('https');
const app = express();
app.use(express.json());

function httpsRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {headers:{'User-Agent':'Mozilla/5.0'}}, (res) => {
      let data = '';
      if(res.statusCode === 301 || res.statusCode === 302) {
        return httpsRequest(res.headers.location).then(resolve).catch(reject);
      }
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function searchComic(query) {
  try {
    const q = encodeURIComponent(query + ' comic plot summary');
    const url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + q + '&format=json&srlimit=3';
    const data = JSON.parse(await httpsRequest(url));
    const results = data.query.search;
    if(!results.length) return '';
    let allText = '';
    for(let i = 0; i < Math.min(2, results.length); i++) {
      const pageId = results[i].pageid;
      const pageUrl = 'https://en.wikipedia.org/w/api.php?action=query&pageids=' + pageId + '&prop=extracts&explaintext=true&format=json';
      const pageData = JSON.parse(await httpsRequest(pageUrl));
      const extract = pageData.query.pages[pageId].extract || '';
      allText += extract.substring(0, 2000) + ' ';
    }
    return allText.trim();
  } catch(e) {
    return '';
  }
}

async function searchDCWiki(query) {
  try {
    const q = encodeURIComponent(query);
    const url = 'https://dc.fandom.com/api.php?action=query&list=search&srsearch=' + q + '&format=json&srlimit=2';
    const data = JSON.parse(await httpsRequest(url));
    const results = data.query.search;
    if(!results || !results.length) return '';
    const pageId = results[0].pageid;
    const pageUrl = 'https://dc.fandom.com/api.php?action=query&pageids=' + pageId + '&prop=extracts&explaintext=true&format=json';
    const pageData = JSON.parse(await httpsRequest(pageUrl));
    const extract = pageData.query.pages[pageId].extract || '';
    return extract.substring(0, 2000);
  } catch(e) {
    return '';
  }
}

async function searchMarvelWiki(query) {
  try {
    const q = encodeURIComponent(query);
    const url = 'https://marvel.fandom.com/api.php?action=query&list=search&srsearch=' + q + '&format=json&srlimit=2';
    const data = JSON.parse(await httpsRequest(url));
    const results = data.query.search;
    if(!results || !results.length) return '';
    const pageId = results[0].pageid;
    const pageUrl = 'https://marvel.fandom.com/api.php?action=query&pageids=' + pageId + '&prop=extracts&explaintext=true&format=json';
    const pageData = JSON.parse(await httpsRequest(pageUrl));
    const extract = pageData.query.pages[pageId].extract || '';
    return extract.substring(0, 2000);
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
    if(isComicRequest) {
      const [wiki, dc, marvel] = await Promise.all([
        searchComic(lastMessage),
        searchDCWiki(lastMessage),
        searchMarvelWiki(lastMessage)
      ]);
      comicInfo = [wiki, dc, marvel].filter(Boolean).join(' ').substring(0, 4000);
    }
    
    const enhancedSystem = system + (comicInfo ? ' RESEARCH DATA FOR THIS COMIC: ' + comicInfo + ' Use this to write an accurate script. If the research data conflicts with your training, trust the research data.' : '');
    
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

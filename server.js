const express = require('express');
const path = require('path');
const https = require('https');
const app = express();
app.use(express.json());

function httpsRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {headers:{'User-Agent':'Mozilla/5.0'}}, (res) => {
      let data = '';
      if(res.statusCode===301||res.statusCode===302) return httpsRequest(res.headers.location).then(resolve).catch(reject);
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function searchComicVine(query) {
  try {
    const q = encodeURIComponent(query);
    const url = 'https://comicvine.gamespot.com/api/search/?api_key=7c7d9f127854ab6dc184d5330a52f5145c0fa9b2&format=json&query='+q+'&resources=issue&field_list=name,description,deck,volume,issue_number';
    const data = JSON.parse(await httpsRequest(url));
    if(!data.results||!data.results.length) return '';
    const issue = data.results[0];
    return 'Comic: '+(issue.volume?issue.volume.name:'')+' Issue '+(issue.issue_number||'')+'. '+(issue.deck||'')+' '+(issue.description||'').replace(/<[^>]*>/g,'').substring(0,2000);
  } catch(e) { return ''; }
}

async function searchWiki(query) {
  try {
    const q = encodeURIComponent(query+' comic plot summary');
    const url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch='+q+'&format=json&srlimit=2';
    const data = JSON.parse(await httpsRequest(url));
    const results = data.query.search;
    if(!results.length) return '';
    const pageId = results[0].pageid;
    const pageUrl = 'https://en.wikipedia.org/w/api.php?action=query&pageids='+pageId+'&prop=extracts&explaintext=true&format=json';
    const pageData = JSON.parse(await httpsRequest(pageUrl));
    return (pageData.query.pages[pageId].extract||'').substring(0,2000);
  } catch(e) { return ''; }
}

async function searchDCWiki(query) {
  try {
    const q = encodeURIComponent(query);
    const url = 'https://dc.fandom.com/api.php?action=query&list=search&srsearch='+q+'&format=json&srlimit=1';
    const data = JSON.parse(await httpsRequest(url));
    if(!data.query.search.length) return '';
    const pageId = data.query.search[0].pageid;
    const pageUrl = 'https://dc.fandom.com/api.php?action=query&pageids='+pageId+'&prop=extracts&explaintext=true&format=json';
    const pageData = JSON.parse(await httpsRequest(pageUrl));
    return (pageData.query.pages[pageId].extract||'').substring(0,2000);
  } catch(e) { return ''; }
}

async function searchMarvelWiki(query) {
  try {
    const q = encodeURIComponent(query);
    const url = 'https://marvel.fandom.com/api.php?action=query&list=search&srsearch='+q+'&format=json&srlimit=1';
    const data = JSON.parse(await httpsRequest(url));
    if(!data.query.search.length) return '';
    const pageId = data.query.search[0].pageid;
    const pageUrl = 'https://marvel.fandom.com/api.php?action=query&pageids='+pageId+'&prop=extracts&explaintext=true&format=json';
    const pageData = JSON.parse(await httpsRequest(pageUrl));
    return (pageData.query.pages[pageId].extract||'').substring(0,2000);
  } catch(e) { return ''; }
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
    const lastMessage = messages[messages.length-1].content;
    const isComicRequest = messages.length <= 2;
    let comicInfo = '';
    if(isComicRequest) {
      const [cv, wiki, dc, marvel] = await Promise.all([
        searchComicVine(lastMessage),
        searchWiki(lastMessage),
        searchDCWiki(lastMessage),
        searchMarvelWiki(lastMessage)
      ]);
      comicInfo = [cv, wiki, dc, marvel].filter(Boolean).join(' ').substring(0,4000);
    }
    const enhancedSystem = system + (comicInfo ? ' RESEARCH DATA: '+comicInfo+' Use this for accuracy. Trust this over your training data.' : '');
    const data = await callAnthropic({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: enhancedSystem,
      messages: messages
    });
    res.json(data);
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});

app.use(express.static('public'));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(process.env.PORT||3000, () => console.log('Volta running'));

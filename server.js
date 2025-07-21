const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_PATH = path.join(__dirname, 'sitemaps.json');

app.use(cors());
app.use(express.json());

function loadSitemaps() {
  try {
    if (fs.existsSync(STORAGE_PATH)) {
      const data = fs.readFileSync(STORAGE_PATH);
      const parsed = JSON.parse(data);
      return parsed.sitemaps || [];
    }
  } catch (err) {
    console.error('Failed to load sitemaps:', err);
  }
  return [];
}

function saveSitemaps(sitemaps) {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify({ sitemaps }, null, 2));
  } catch (err) {
    console.error('Failed to save sitemaps:', err);
  }
}

async function submitToSearchEngines(sitemapUrl) {
  const engines = [
    { name: 'Google', url: `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` },
    { name: 'Bing', url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` }
  ];

  const results = [];

  for (const engine of engines) {
    try {
      const response = await axios.get(engine.url);
      results.push({ engine: engine.name, status: response.status });
    } catch (err) {
      results.push({ engine: engine.name, status: 'Failed', message: err.message });
    }
  }

  return results;
}

app.get('/sitemaps', (req, res) => {
  const sitemaps = loadSitemaps();
  res.json({ sitemaps });
});

app.post('/sitemaps', async (req, res) => {
  const { sitemapUrl } = req.body;
  if (!sitemapUrl || !sitemapUrl.endsWith('.xml') || !sitemapUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid sitemap URL' });
  }

  const sitemaps = loadSitemaps();
  if (!sitemaps.includes(sitemapUrl)) {
    sitemaps.push(sitemapUrl);
    saveSitemaps(sitemaps);
  }

  const results = await submitToSearchEngines(sitemapUrl);
  res.json({ submitted: true, results });
});

app.delete('/sitemaps', (req, res) => {
  const { sitemapUrl } = req.body;
  if (!sitemapUrl) {
    return res.status(400).json({ error: 'sitemapUrl is required' });
  }

  let sitemaps = loadSitemaps();
  sitemaps = sitemaps.filter(url => url !== sitemapUrl);
  saveSitemaps(sitemaps);

  res.json({ removed: true, remaining: sitemaps });
});

// Automatically

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGA4Data } from './ga4.js';
import { getMetaChanges, getMetaSpend } from './meta.js';

const app = express();
app.use(cors());

// Endpoint API
app.get('/api/metrics', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
    const endDate = dayjs().format('YYYY-MM-DD');

    const ga4Data = await getGA4Data(
      process.env.GA4_PROPERTY_ID,
      startDate,
      endDate
    );

    const metaData = await getMetaChanges(
      process.env.META_AD_ACCOUNT_ID,
      process.env.META_ACCESS_TOKEN,
      startDate,
      endDate
    );

    const spendData = await getMetaSpend(
      process.env.META_AD_ACCOUNT_ID,
      process.env.META_ACCESS_TOKEN,
      startDate,
      endDate
    );

    const metaByDate = metaData.reduce((acc, m) => {
      if (!acc[m.date]) acc[m.date] = [];
      acc[m.date].push(m.description);
      return acc;
    }, {});

    Object.keys(metaByDate).forEach(date => {
      metaByDate[date] = [...new Set(metaByDate[date])].join(' | ');
    });

    const spendByDate = spendData.reduce((acc, s) => {
      acc[s.date] = s.spend;
      return acc;
    }, {});

    const merged = ga4Data.map(row => ({
      ...row,
      meta_actions: metaByDate[row.date] || '',
      meta_spend: spendByDate[row.date] || 0
    }));

    res.json(merged);
  } catch (error) {
    console.error('❌ Błąd w API /api/metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// === Serwowanie frontu ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(distPath));

// Fallback SPA — dla wszystkiego poza /api serwujemy index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server API + Front działa na porcie ${PORT}`);
});

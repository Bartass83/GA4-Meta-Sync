import 'dotenv/config';
import { getGA4Data } from './ga4.js';
import { getMetaChanges, getMetaSpend } from './meta.js';
import { Parser } from 'json2csv';
import { saveToGoogleSheet } from './sheets.js';
import fs from 'fs';

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

async function main() {
  try {
    // Pobranie danych z GA4 i Meta
    const ga4Data = await getGA4Data(GA4_PROPERTY_ID);
    const metaData = await getMetaChanges(META_AD_ACCOUNT_ID, META_ACCESS_TOKEN);
    const spendData = await getMetaSpend(META_AD_ACCOUNT_ID, META_ACCESS_TOKEN);

    // Grupowanie akcji Meta po dacie
    const metaByDate = metaData.reduce((acc, m) => {
      if (!acc[m.date]) acc[m.date] = [];
      acc[m.date].push(m.description);
      return acc;
    }, {});
    Object.keys(metaByDate).forEach(date => {
      metaByDate[date] = [...new Set(metaByDate[date])].join(' | ');
    });

    // Mapowanie wydatków
    const spendByDate = spendData.reduce((acc, s) => {
      acc[s.date] = s.spend;
      return acc;
    }, {});

    // Scalanie danych
    const merged = ga4Data.map(row => ({
      ...row,
      meta_actions: metaByDate[row.date] || '',
      meta_spend: spendByDate[row.date] || 0
    }));

    // Zapis do CSV
    const parser = new Parser();
    const csv = parser.parse(merged);
    fs.writeFileSync('ga4_meta.csv', csv);

    // Zapis do Google Sheets
    await saveToGoogleSheet(merged);

    console.log('✅ Zapisano dane do CSV i Google Sheets');
  } catch (error) {
    console.error('❌ Błąd w main():', error);
  }
}

main();

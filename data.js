import { getGA4Data } from './ga4.js';
import { getMetaChanges, getMetaSpend } from './meta.js';

const GA4_PROPERTY_ID = '467126111';
const META_AD_ACCOUNT_ID = 'act_1081838083425034';
const META_ACCESS_TOKEN = 'TWÓJ_TOKEN';

export async function buildMerged({ startDate, endDate }) {
  const [ga4Data, metaData, spendData] = await Promise.all([
    getGA4Data(GA4_PROPERTY_ID, { startDate, endDate }),
    getMetaChanges(META_AD_ACCOUNT_ID, META_ACCESS_TOKEN, { startDate, endDate }),
    getMetaSpend(META_AD_ACCOUNT_ID, META_ACCESS_TOKEN, { startDate, endDate }),
  ]);

  const metaByDate = metaData.reduce((acc, m) => {
    if (!acc[m.date]) acc[m.date] = [];
    acc[m.date].push(m.description);
    return acc;
  }, {});

  const spendByDate = spendData.reduce((acc, s) => {
    acc[s.date] = s.spend;
    return acc;
  }, {});

  return ga4Data.map(row => ({
    ...row,
    meta_actions: metaByDate[row.date] || [],
    meta_spend: spendByDate[row.date] || 0
  }));
}

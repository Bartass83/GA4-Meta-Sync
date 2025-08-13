// meta.js
import axios from 'axios';
import dayjs from 'dayjs';

const eventDescriptions = {
  update_ad_set_target_spec: "Zmieniono grupę odbiorców w zestawie reklam",
  update_ad_set_budget: "Zmieniono budżet zestawu reklam",
  update_ad_set_run_status: "Zmieniono status zestawu reklam",
  update_ad_friendly_name: "Zmieniono nazwę reklamy",
  create_ad: "Utworzono reklamę",
  update_ad_creative: "Zmieniono kreację",
  update_ad_run_status: "Zmieniono status reklamy",
  update_campaign_budget: "Zmieniono budżet kampanii",
  update_campaign_name: "Zmieniono nazwę kampanii",
  create_campaign: "Utworzono kampanię"
};

export async function getMetaChanges(adAccountId, accessToken, startDate, endDate) {
  const since = startDate || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const until = endDate || dayjs().format('YYYY-MM-DD');

  let url = `https://graph.facebook.com/v19.0/${adAccountId}/activities?access_token=${accessToken}&since=${since}&until=${until}&limit=100`;
  const all = [];

  try {
    while (url) {
      const res = await axios.get(url);
      const data = res?.data?.data ?? [];
      const filtered = data
        .filter(it => eventDescriptions[it.event_type])
        .map(it => ({
          date: dayjs(it.event_time).format('YYYY-MM-DD'),
          event_type: it.event_type,
          description: eventDescriptions[it.event_type] || it.event_type,
          object_name: it.object_name || '',
        }));
      all.push(...filtered);
      url = res?.data?.paging?.next || null;
    }
    return all;
  } catch (e) {
    console.error('Błąd pobierania danych z Meta Ads API:', e?.response?.data || e.message);
    return [];
  }
}

/**
 * Dzienne wydatki:
 * 1) próbujemy /insights (level=account, time_increment=1, fields=spend,date_start)
 * 2) gdzie jest 0, dogrywamy kwoty z /transactions (time,amount)
 * 3) zwracamy pełny zakres dni (luki = 0)
 */
export async function getMetaSpend(adAccountId, accessToken, startDate, endDate) {
  const since = startDate || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const until = endDate || dayjs().format('YYYY-MM-DD');

  // zbuduj pełną listę dni
  const allDates = [];
  {
    let d = dayjs(since);
    const end = dayjs(until);
    while (d.isBefore(end) || d.isSame(end, 'day')) {
      allDates.push(d.format('YYYY-MM-DD'));
      d = d.add(1, 'day');
    }
  }

  // 1) INSIGHTS
  const insightsUrl = `https://graph.facebook.com/v19.0/${adAccountId}/insights`;
  const insightsParams = {
    access_token: accessToken,
    time_range: { since, until },
    time_increment: 1,
    level: 'account',
    fields: 'spend,date_start',
    // use_account_attribution_setting: true, // opcjonalnie
  };

  const spendMap = {};
  try {
    let nextUrl = insightsUrl;
    let nextParams = { ...insightsParams };
    while (nextUrl) {
      const res = await axios.get(nextUrl, { params: nextParams });
      const rows = res?.data?.data ?? [];
      rows.forEach(r => {
        const d = r?.date_start;
        const v = parseFloat(r?.spend || 0);
        if (d) spendMap[d] = (spendMap[d] || 0) + (isNaN(v) ? 0 : v);
      });
      nextUrl = res?.data?.paging?.next || null;
      nextParams = undefined;
    }
  } catch (e) {
    console.error('Błąd pobierania wydatków z Insights:', e?.response?.data || e.message);
  }

  // 2) Fallback: TRANSACTIONS (tylko dla dni, gdzie spend=0)
  try {
    const txUrl = `https://graph.facebook.com/v19.0/${adAccountId}/transactions`;
    const txParams = {
      access_token: accessToken,
      start_time: since,
      end_time: until,
      fields: 'time,amount',
      limit: 500,
    };
    const txRes = await axios.get(txUrl, { params: txParams });
    const txRows = txRes?.data?.data ?? [];
    // zsumuj kwoty per dzień (maksyma: wartości mogą być ujemne – bierzemy wartość bezwzględną)
    const txByDate = {};
    txRows.forEach(tx => {
      const d = dayjs(tx?.time).format('YYYY-MM-DD');
      const v = Math.abs(parseFloat(tx?.amount || 0));
      txByDate[d] = (txByDate[d] || 0) + (isNaN(v) ? 0 : v);
    });
    // podmień tylko dni, które w insights są puste/zerowe
    Object.keys(txByDate).forEach(d => {
      if (!spendMap[d] || spendMap[d] === 0) {
        spendMap[d] = txByDate[d];
      }
    });
  } catch (e) {
    console.error('Błąd pobierania Transactions:', e?.response?.data || e.message);
  }

  // 3) zwróć pełny zakres
  return allDates.map(d => ({
    date: d,
    spend: Number(spendMap[d] || 0),
  }));
}

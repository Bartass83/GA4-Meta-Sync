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

// 📌 1. Pobieranie zmian w kampaniach
export async function getMetaChanges(adAccountId, accessToken) {
  const since = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const until = dayjs().format('YYYY-MM-DD');

  let url = `https://graph.facebook.com/v19.0/${adAccountId}/activities?access_token=${accessToken}&since=${since}&until=${until}&limit=100`;

  let allData = [];

  try {
    while (url) {
      const res = await axios.get(url);
      const data = res.data.data || [];

      const filtered = data
        .filter(item => eventDescriptions[item.event_type])
        .map(item => ({
          date: dayjs(item.event_time).format('YYYY-MM-DD'),
          event_type: item.event_type,
          description: eventDescriptions[item.event_type] || item.event_type,
          object_name: item.object_name || ''
        }));

      allData.push(...filtered);
      url = res.data.paging?.next || null;
    }

    return allData;
  } catch (error) {
    console.error('Błąd pobierania danych z Meta Ads API:', error.response?.data || error.message);
    return [];
  }
}

// 📌 2. Pobieranie wydatków jako różnica z total_spent
export async function getMetaSpend(adAccountId, accessToken) {
  try {
    // Pobieramy dane dzienne (narastająco)
    const since = dayjs().subtract(30, 'days').format('YYYY-MM-DD');
    const until = dayjs().format('YYYY-MM-DD');

    const url = `https://graph.facebook.com/v19.0/${adAccountId}/insights`;
    const params = {
      access_token: accessToken,
      level: 'account',
      time_range: { since, until },
      time_increment: 1,
      fields: 'account_currency,total_spent,date_start'
    };

    const res = await axios.get(url, { params });
    const rows = res.data.data || [];

    // Wyliczamy różnice dzień po dniu
    let prevTotal = null;
    const dailySpend = rows.map(row => {
      const total = parseFloat(row.total_spent || 0);
      let spend = 0;

      if (prevTotal !== null) {
        spend = total - prevTotal;
        if (spend < 0) spend = 0; // zabezpieczenie przed resetem salda
      }
      prevTotal = total;

      return {
        date: row.date_start,
        spend: parseFloat(spend.toFixed(2))
      };
    });

    return dailySpend;
  } catch (error) {
    console.error('Błąd pobierania wydatków z Meta Ads API:', error.response?.data || error.message);
    return [];
  }
}

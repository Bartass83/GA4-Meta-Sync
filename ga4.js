import { BetaAnalyticsDataClient } from '@google-analytics/data';
import dayjs from 'dayjs';

const client = new BetaAnalyticsDataClient({
  keyFilename: 'credentials_ga4.json'
});

export async function getGA4Data(propertyId, startDate, endDate) {
  const [usersResp] = await client.runReport({
    property: `properties/${propertyId}`,
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'totalUsers' },
      { name: 'purchaseRevenue' }
    ],
    dateRanges: [{ startDate, endDate }]
  });
  
  const usersMap = {};
  const revenueMap = {};
  usersResp.rows.forEach(r => {
    const date = dayjs(r.dimensionValues[0].value).format('YYYY-MM-DD');
    usersMap[date] = Number(r.metricValues[0].value);
    revenueMap[date] = Number(r.metricValues[1].value);
  });

  // 2. Add to cart
  const [cartResp] = await client.runReport({
    property: `properties/${propertyId}`,
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: { fieldName: 'eventName', stringFilter: { value: 'add_to_cart' } }
    },
    dateRanges: [{ startDate, endDate }]
  });

  const cartMap = Object.fromEntries(
    cartResp.rows.map(r => [
      dayjs(r.dimensionValues[0].value).format('YYYY-MM-DD'),
      Number(r.metricValues[0].value)
    ])
  );

  // 3. Purchases
  const [purchaseResp] = await client.runReport({
    property: `properties/${propertyId}`,
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: { fieldName: 'eventName', stringFilter: { value: 'purchase' } }
    },
    dateRanges: [{ startDate, endDate }]
  });

  const purchaseMap = Object.fromEntries(
    purchaseResp.rows.map(r => [
      dayjs(r.dimensionValues[0].value).format('YYYY-MM-DD'),
      Number(r.metricValues[0].value)
    ])
  );

  // 4. Zakres dat
  const allDates = [];
  const start = dayjs(startDate === 'today' ? dayjs() : startDate);
  const end = dayjs(endDate === 'today' ? dayjs() : endDate);

  for (let d = start; d.isBefore(end) || d.isSame(end); d = d.add(1, 'day')) {
    allDates.push(d.format('YYYY-MM-DD'));
  }

  // 5. Łączenie wyników
  return allDates.map(date => ({
    date,
    total_users: usersMap[date] || 0,
    add_to_cart: cartMap[date] || 0,
    purchases: purchaseMap[date] || 0,
    purchase_revenue: revenueMap[date] || 0
  }));
}



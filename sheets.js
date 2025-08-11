import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';

const SPREADSHEET_ID = '1iOgULbHCDVvFh6YWNc2NeGVrhXRKYeQCe0amV2Fg6vQ';
const CREDENTIALS = JSON.parse(fs.readFileSync('credentials_sheets.json', 'utf-8'));

const serviceAccountAuth = new JWT({
  email: CREDENTIALS.client_email,
  key: CREDENTIALS.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

export async function saveToGoogleSheet(rows) {
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[0];
  await sheet.clear(); // wyczyść arkusz

  const headers = Object.keys(rows[0]);
  await sheet.setHeaderRow(headers);

  await sheet.addRows(rows);
  console.log('✅ Dane zapisane do Google Sheets');
}

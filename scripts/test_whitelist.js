const { db } = require('./backend/db');
const r = db.prepare("SELECT value FROM settings WHERE key='allowed_emails'").get();
if (!r) { console.log('No whitelist configured'); process.exit(0); }
console.log('Raw value:', JSON.stringify(r.value));
let arr = [];
try { arr = JSON.parse(r.value); console.log('JSON.parse OK'); }
catch (e) { console.log('JSON.parse FAILED:', e.message); }
console.log('Array:', JSON.stringify(arr));
console.log('Length:', arr.length);

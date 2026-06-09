#!/usr/bin/env node

const http = require('http');
const https = require('https');

// Cargar .env si existe
try { require('fs').readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w_]+)\s*=\s*(.+?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/["']/g, '');
}); } catch (_) {}

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.argv[2] || process.env.PB_ADMIN_EMAIL;
const ADMIN_PASS = process.argv[3] || process.env.PB_ADMIN_PASS;

if (!ADMIN_EMAIL || !ADMIN_PASS) {
  console.log('Uso: node setup.js admin@email.com contraseña');
  process.exit(1);
}

function req(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, PB_URL);
    const opts = {
      method, hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const lib = url.protocol === 'https:' ? https : http;
    const r = lib.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(JSON.stringify(data));
    r.end();
  });
}

async function getColId(name, token) {
  const r = await req('GET', `/api/collections?filter=name="${name}"`, null, token);
  return r.data?.items?.[0]?.id || null;
}

async function upsertCollection(col, token) {
  const existing = await getColId(col.name, token);
  if (existing) {
    console.log(`   ⏭️  "${col.name}" ya existe`);
    return existing;
  }
  const r = await req('POST', '/api/collections', col, token);
  if (r.status === 200 || r.status === 201) {
    console.log(`   ✅ "${col.name}" creada`);
    return r.data.id;
  }
  if (r.status === 400 && r.data?.data?.name) {
    console.log(`   ⏭️  "${col.name}" ya existe (conflicto)`);
    return await getColId(col.name, token);
  }
  console.error(`   ❌ "${col.name}": ${r.data?.message || JSON.stringify(r.data)}`);
  return null;
}

async function addFieldToCollection(colIdOrName, fieldDef, token) {
  const r = await req('GET', `/api/collections/${colIdOrName}`, null, token);
  if (r.status !== 200) return false;
  const col = r.data;
  const hasField = col.fields.some(f => f.name === fieldDef.name);
  if (hasField) {
    console.log(`   ⏭️  Campo "${fieldDef.name}" ya existe en "${col.name}"`);
    return true;
  }
  col.fields.push(fieldDef);
  const upd = await req('PATCH', `/api/collections/${col.id}`, { fields: col.fields }, token);
  if (upd.status === 200) {
    console.log(`   ✅ Campo "${fieldDef.name}" agregado a "${col.name}"`);
    return true;
  }
  console.error(`   ❌ Error al agregar "${fieldDef.name}": ${upd.data?.message || upd.status}`);
  return false;
}

async function main() {
  console.log('🔐 Autenticando admin...');
  const auth = await req('POST', '/api/collections/_superusers/auth-with-password',
    { identity: ADMIN_EMAIL, password: ADMIN_PASS });
  if (auth.status !== 200) {
    console.error('Error de autenticación. ¿Ya creaste el admin?');
    process.exit(1);
  }
  const token = auth.data.token;
  const usersColId = '_pb_users_auth_';

  // ---- MATCHES ----
  let matchesColId = await getColId('matches', token);
  if (!matchesColId) {
    matchesColId = await upsertCollection({
      name: 'matches', type: 'base',
      fields: [
        { name: 'date', type: 'text', required: true, max: 10 },
        { name: 'time', type: 'text', required: true, max: 5 },
        { name: 'home_team', type: 'text', required: true, max: 100 },
        { name: 'away_team', type: 'text', required: true, max: 100 },
        { name: 'home_score', type: 'number' },
        { name: 'away_score', type: 'number' },
        { name: 'status', type: 'select', required: true, values: ['open', 'closed', 'finished'], maxSelect: 1 },
        { name: 'round', type: 'select', values: ['group', 'round_32', 'round_16', 'quarter', 'semi', 'final'], maxSelect: 1 },
      ],
      listRule: '', viewRule: '',
      createRule: `@request.auth.email = "${ADMIN_EMAIL}"`,
      updateRule: `@request.auth.email = "${ADMIN_EMAIL}"`,
      deleteRule: `@request.auth.email = "${ADMIN_EMAIL}"`,
    }, token);
  } else {
    console.log('   ✅ "matches" encontrada');
    await addFieldToCollection(matchesColId, {
      name: 'round', type: 'select', values: ['group', 'round_32', 'round_16', 'quarter', 'semi', 'final'], maxSelect: 1,
    }, token);
  }

  // ---- PREDICTIONS ----
  let predColId = await getColId('predictions', token);
  if (!predColId) {
    predColId = await upsertCollection({
      name: 'predictions', type: 'base',
      fields: [
        { name: 'user', type: 'relation', required: true, collectionId: usersColId, maxSelect: 1, cascadeDelete: true },
        { name: 'match', type: 'relation', required: true, collectionId: matchesColId, maxSelect: 1, cascadeDelete: true },
        { name: 'home_score', type: 'number', required: true, min: 0, max: 99, onlyInt: true },
        { name: 'away_score', type: 'number', required: true, min: 0, max: 99, onlyInt: true },
        { name: 'comodin', type: 'bool' },
      ],
      listRule: `@request.auth.id = user || @request.auth.email = "${ADMIN_EMAIL}"`,
      viewRule: `@request.auth.id = user || @request.auth.email = "${ADMIN_EMAIL}"`,
      createRule: `@request.auth.id != ""`,
      updateRule: null,
      deleteRule: `@request.auth.email = "${ADMIN_EMAIL}"`,
    }, token);
  } else {
    console.log('   ✅ "predictions" encontrada');
    await addFieldToCollection(predColId, { name: 'comodin', type: 'bool' }, token);
    await req('PATCH', `/api/collections/${predColId}`,
      { updateRule: null }, token);
  }

  // ---- CHAMPION_PICKS ----
  await upsertCollection({
    name: 'champion_picks', type: 'base',
    fields: [
      { name: 'user', type: 'relation', required: true, collectionId: usersColId, maxSelect: 1, cascadeDelete: true },
      { name: 'champion', type: 'text', required: true, max: 100 },
    ],
    listRule: `@request.auth.id = user || @request.auth.email = "${ADMIN_EMAIL}"`,
    viewRule: `@request.auth.id = user || @request.auth.email = "${ADMIN_EMAIL}"`,
    createRule: `@request.auth.id != ""`,
    updateRule: null,
    deleteRule: `@request.auth.email = "${ADMIN_EMAIL}"`,
  }, token);

  // ---- SETTINGS ----
  await upsertCollection({
    name: 'settings', type: 'base',
    fields: [
      { name: 'key', type: 'text', required: true, max: 100 },
      { name: 'value', type: 'text', max: 500 },
    ],
    listRule: '',
    viewRule: '',
    createRule: `@request.auth.email = "${ADMIN_EMAIL}"`,
    updateRule: `@request.auth.email = "${ADMIN_EMAIL}"`,
    deleteRule: `@request.auth.email = "${ADMIN_EMAIL}"`,
  }, token);

  // ---- GOOGLE OAUTH (desde .env) ----
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (googleClientId && googleClientSecret) {
    console.log('\n🔑 Configurando Google OAuth...');
    const col = await req('GET', '/api/collections/users', null, token);
    if (col.status === 200 && col.data) {
      const oauth2 = col.data.oauth2 || {};
      oauth2.enabled = true;
      oauth2.providers = [{
        name: 'google',
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      }];
      const upd = await req('PATCH', '/api/collections/users',
        { oauth2 }, token);
      if (upd.status === 200) {
        console.log('   ✅ Google OAuth configurado');
        console.log(`   Client ID: ${googleClientId.slice(0, 20)}...`);
      } else {
        console.log(`   ❌ Error: ${upd.data?.message || upd.status}`);
      }
    }
  } else if (googleClientId || googleClientSecret) {
    console.log('\n⚠️  Google OAuth: faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env');
  } else {
    console.log('\n⏭️  Google OAuth: no configurado (poner GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env)');
  }

  console.log('\n✅ Setup completo!');
  console.log('📌 Si ya tenías datos, revisá que los campos se hayan agregado correctamente.');
}

main().catch(console.error);

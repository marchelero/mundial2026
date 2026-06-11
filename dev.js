const { spawn } = require('child_process');
const path = require('path');

const backend = spawn('node', ['backend/server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.BACKEND_PORT || '3001' },
});

const frontend = spawn('node', ['frontend/server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.FRONTEND_PORT || '3000' },
});

process.on('SIGINT', () => {
  backend.kill();
  frontend.kill();
  process.exit();
});

backend.on('close', (code) => {
  console.log(`Backend exited with code ${code}`);
  frontend.kill();
});

frontend.on('close', (code) => {
  console.log(`Frontend exited with code ${code}`);
  backend.kill();
});

-- ============================================
-- WHITELIST - Lista de correos permitidos
-- ============================================
-- 
-- Uso: ejecutar contra la base de datos SQLite
--   sqlite3 data/mundial2026.db < scripts/whitelist.sql
--
-- Si la tabla settings no existe, se crea sola
-- al iniciar la app. Este script solo inserta
-- o actualiza la fila de whitelist.
--
-- Formato: JSON array de correos en minúsculas.
-- Vacío ([]) = todos pueden ingresar.
-- ============================================

-- Insertar o reemplazar la lista de permitidos
-- Editar los correos entre corchetes antes de ejecutar
INSERT OR REPLACE INTO settings (id, key, value) VALUES (
  'wl_' || lower(hex(randomblob(8))),
  'allowed_emails',
  '["marcheloalbis@gmail.com", "amigo1@gmail.com", "amigo2@gmail.com"]'
);

-- Para verificar:
-- SELECT * FROM settings WHERE key = 'allowed_emails';

-- Para desactivar la whitelist (todos pueden entrar):
-- INSERT OR REPLACE INTO settings (id, key, value) VALUES (
--   'wl_' || lower(hex(randomblob(8))),
--   'allowed_emails',
--   '[]'
-- );

# Whitelist Obligatoria + Validación de Emails

**Fecha:** 2026-06-11
**Proyecto:** Mundial 2026 - Polla

## Contexto

La app tiene una whitelist de emails que controla qué usuarios pueden acceder. Actualmente:
- La whitelist es opcional (vacía = todos pueden entrar)
- La validación de emails es mínima solo en frontend
- La interfaz admin ya está implementada

## Problemas a resolver

1. **Whitelist no es obligatoria**: cualquier persona puede hacer login si la lista está vacía
2. **Validación de emails débil**: el backend no valida formato ni evita duplicados
3. **UX pobre**: no hay advertencia clara cuando la whitelist está vacía

## Especificación

### 1. Backend — Auth (`routes/auth.js`)

**Cambio**: El endpoint `POST /api/auth/google` siempre debe verificar la whitelist. Si `allowed_emails` está vacío, no existe, o es `[]`, se rechaza el login con:

```
Status: 403
{ "error": "Acceso restringido. No hay emails permitidos configurados. Contacta al administrador." }
```

Solo se permite el login si el email del usuario está en `allowed_emails`.

### 2. Backend — Settings (`routes/settings.js`)

Al guardar la setting `allowed_emails`:

- Validar que el array tenga al menos 1 email
- Validar formato de cada email con regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Sanitizar: trim, lowercase, eliminar duplicados
- Si se intenta guardar una lista vacía → error 400

### 3. Frontend — Admin (`components/Admin.js`)

**Eliminar email**:
- Si solo queda 1 email, deshabilitar el botón ✕
- Mostrar tooltip/title: "Debe haber al menos 1 email permitido"

**Whitelist vacía**:
- Mostrar mensaje en rojo en lugar del mensaje gris actual:
  "⚠️ Agrega al menos un email — sin emails configurados, NADIE puede ingresar"

**Validación**:
- Mantener validación existente (`includes('@')`)
- Agregar feedback visual si el email no es válido

### 4. Frontend — Auth (`services/auth.js`) — opcional

Mostrar mensaje de error claro si el backend rechaza con 403:

> "Acceso restringido. Tu correo no está en la lista de permitidos. Contacta al administrador."

## No incluye

- Sistema de invitaciones
- Roles de usuario (admin, usuario normal)
- Página pública de registro

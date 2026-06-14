# Notificaciones WhatsApp y templates de Meta

Las notificaciones por WhatsApp (confirmaciones, recordatorios, alertas, OTP histórico,
invitación de cuenta) usan **templates aprobados por Meta**. El estado vive en el modelo
`NotificacionPlantilla` (Postgres) y el envío real pasa por `src/lib/whatsapp/service.ts`.

## Los dos scripts de seed (¡son distintos!)

**Importante:** crear la fila en la base de datos y crear el template en Meta son
**dos pasos separados**. Ambos scripts son **idempotentes** (solo crean lo que falta).

| Script | Qué hace | Toca Meta |
|---|---|---|
| `scripts/seed-notificaciones.ts` | Crea las **filas** `NotificacionPlantilla` en la DB (lista `DEFAULT_PLANTILLAS`) + `NotificacionConfig`. Salta las que ya existen por `tipo`. | No |
| `scripts/seed-meta-templates.ts` | Lee las plantillas de la DB y **crea el template en Meta** (Graph API) para las que aún **no** tienen `whatsappDefaultTemplateName`. Guarda nombre + status (`PENDING` hasta aprobación). | **Sí** |

```bash
cd apps/admin
npx tsx scripts/seed-notificaciones.ts     # 1. filas en la DB (seguro, sin efectos externos)
npx tsx scripts/seed-meta-templates.ts     # 2. crea templates reales en tu cuenta de Meta
```

`prisma/seed.ts` (el `npx prisma db seed`) **no** siembra plantillas — solo admin,
tipos de actividad y EmpresaConfig. Las plantillas viven en `seed-notificaciones.ts`.

## Aprobación en Meta

`seed-meta-templates.ts` crea los templates en estado `PENDING`. Meta los revisa
(minutos a horas). El estado se actualiza por el webhook de Meta o con "Verificar
estado" en la app (`/api/notificaciones/plantillas/[id]/meta`). Hasta que estén
`APPROVED`, `service.ts` no puede enviarlos y cae al fallback (consola en dev).

Categorías: la mayoría son `UTILITY`; `AUTENTICACION_OTP` es `AUTHENTICATION`;
`INVITACION_CUENTA` es `UTILITY` con botón URL (ver abajo).

## INVITACION_CUENTA (enlace para crear contraseña)

Meta normalmente **rechaza** una URL cruda como parámetro en el cuerpo. Por eso este
template usa un **botón URL dinámico**, no texto:

- **Cuerpo:** `Hola {{1}}, crea tu contraseña para acceder a la app de Vivero Francisco.`
  (`{{1}}` = nombre).
- **Botón URL:** texto "Crear contraseña", URL `${APP_BASE_URL}/establecer-contrasena?token={{1}}`
  donde `{{1}}` (sufijo, debe ir al final de la URL) = el token.

El dominio base se **fija al crear el template** desde `APP_BASE_URL`, así que esa
variable debe ser la **URL pública real** al correr `seed-meta-templates.ts`. Al enviar,
`enviarInvitacionCuenta()` manda `nombre` como parámetro del cuerpo y el `token` como
parámetro del botón.

Si cambias el dominio público, hay que **recrear** el template (borrar en Meta y volver
a correr el seed) para actualizar la URL base del botón.

## Agregar un template nuevo

1. Agrega el valor al enum `TipoNotificacion` en `prisma/schema.prisma` + migración.
2. Agrega la entrada a `DEFAULT_PLANTILLAS` en `seed-notificaciones.ts` y corre el script.
3. Si necesita forma especial (botón URL, OTP), agrega una rama en `seed-meta-templates.ts`.
4. Agrega la función de envío en `src/lib/whatsapp/service.ts`.
5. Corre `seed-meta-templates.ts` y espera la aprobación de Meta.

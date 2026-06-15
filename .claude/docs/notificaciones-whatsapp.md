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

## Invitación de cuenta: NO usa WhatsApp

La invitación para crear contraseña se envía **solo por correo** (Gmail API), no por
WhatsApp. Se intentó un template con botón URL, pero Meta lo rechaza con
`INCORRECT_CATEGORY` (un enlace de "crear contraseña" no encaja en sus categorías).
Ver [autenticacion-clientes.md](./autenticacion-clientes.md).

## Agregar un template nuevo

1. Agrega el valor al enum `TipoNotificacion` en `prisma/schema.prisma` + migración.
2. Agrega la entrada a `DEFAULT_PLANTILLAS` en `seed-notificaciones.ts` y corre el script.
3. Si necesita forma especial (botón URL, OTP), agrega una rama en `seed-meta-templates.ts`.
4. Agrega la función de envío en `src/lib/whatsapp/service.ts`.
5. Corre `seed-meta-templates.ts` y espera la aprobación de Meta.

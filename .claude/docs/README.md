# Documentación

Contexto extendido del proyecto. `CLAUDE.md` (en la raíz) se mantiene corto y apunta
aquí para los detalles.

- [autenticacion-clientes.md](./autenticacion-clientes.md) — login de clientes por
  teléfono/correo + contraseña, flujo de invitación/set-password, y envío de correo por
  la Gmail API (cuenta de servicio).
- [notificaciones-whatsapp.md](./notificaciones-whatsapp.md) — sistema de templates de
  WhatsApp/Meta, los dos scripts de seed (DB vs Meta) y el template `INVITACION_CUENTA`
  con botón URL.
- [base-de-datos-y-migraciones.md](./base-de-datos-y-migraciones.md) — branches de Neon
  (nunca apuntar el `.env` a producción), migraciones automáticas en cada deploy, cuándo
  hay que escribir el SQL a mano, y cómo verificar contra datos reales.
- [facturacion-contifico.md](./facturacion-contifico.md) — integración con Contífico:
  frontera de responsabilidades, las trampas de su API (el listado de productos que se
  cuelga, el código como llave anti-duplicados, el IVA 15% en un campo llamado
  `subtotal_12`), y el manejo de la numeración del SRI.

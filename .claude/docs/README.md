# Documentación

Contexto extendido del proyecto. `CLAUDE.md` (en la raíz) se mantiene corto y apunta
aquí para los detalles.

- [autenticacion-clientes.md](./autenticacion-clientes.md) — contraseñas: enlaces de
  invitación y restablecimiento para clientes **y** para usuarios del portal (nadie
  elige la contraseña de otro), login de clientes por teléfono/correo, y envío de
  correo por la Gmail API.
- [notificaciones-whatsapp.md](./notificaciones-whatsapp.md) — sistema de templates de
  WhatsApp/Meta, los dos scripts de seed (DB vs Meta) y el template `INVITACION_CUENTA`
  con botón URL.
- [base-de-datos-y-migraciones.md](./base-de-datos-y-migraciones.md) — branches de Neon
  (nunca apuntar el `.env` a producción), migraciones automáticas en cada deploy, cuándo
  hay que escribir el SQL a mano, y cómo verificar contra datos reales.
- [facturacion-sri.md](./facturacion-sri.md) — facturación electrónica propia: el
  esquema *offline* del SRI y la clave de acceso, los emisores y su firma `.p12`
  cifrada, la numeración por serie, el RIDE, los cobros, las notas de crédito, y las
  reglas que van de la orden a la factura.

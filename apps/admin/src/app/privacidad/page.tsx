import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad — Vivero Francisco",
  description:
    "Qué datos recoge la app y el portal de Vivero Francisco, para qué los usa y cómo pedir que se corrijan o se borren.",
};

/**
 * La política de privacidad que piden las tiendas —App Store y Google Play
 * exigen una URL pública— y la Ley Orgánica de Protección de Datos Personales
 * del Ecuador. Pública: vive fuera de `/dashboard`, así que el middleware no
 * pide sesión.
 *
 * **Tiene que decir lo que la app hace de verdad.** Si se agrega un permiso,
 * un proveedor o un dato nuevo, se actualiza acá y en el cuestionario de
 * privacidad de cada tienda en el mismo cambio: una política que no coincide
 * con la app es motivo de rechazo, y una promesa que no se cumple.
 */
const CONTACTO = "info@viverofrancisco.com";
const ACTUALIZADA = "30 de septiembre de 2026";

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-white p-6 text-[15px] leading-relaxed text-gray-700 shadow-sm md:p-10">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Política de privacidad</h1>
          <p className="text-sm text-gray-500">
            Vivero Francisco · Última actualización: {ACTUALIZADA}
          </p>
        </header>

        <p>
          Esta política explica qué datos personales recogen la aplicación móvil{" "}
          <strong>Vivero Francisco</strong> y el portal{" "}
          <strong>admin.viverofrancisco.com</strong> (juntos, “la app”), para qué
          los usamos y qué derechos tienes sobre ellos. El responsable del
          tratamiento es <strong>Viverofrancisco S.A.S.</strong>, en Guayaquil,
          Ecuador.
        </p>

        <Seccion titulo="Quién usa la app">
          <p>
            La app es una herramienta de trabajo del vivero. La usan su equipo
            —administradores, staff y personal de campo— y sus clientes, para
            ver sus visitas de mantenimiento. No es una red social ni una tienda
            abierta al público: las cuentas las crea un administrador del
            vivero, y cada persona elige su propia contraseña con un enlace de
            un solo uso. No está dirigida a menores de edad.
          </p>
        </Seccion>

        <Seccion titulo="Qué datos recogemos">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Datos de la cuenta:</strong> nombre, apellido, usuario,
              correo electrónico y teléfono. La contraseña se guarda cifrada;
              nadie del vivero puede verla.
            </li>
            <li>
              <strong>Datos de clientes:</strong> nombre, contacto, datos de
              facturación y las direcciones de sus propiedades, con su ubicación
              en el mapa y sus medidas.
            </li>
            <li>
              <strong>Ubicación:</strong> cuando alguien del personal marca su
              entrada o su salida de una visita, o reporta que no pudo hacerla,
              la app registra la ubicación del teléfono en ese momento, su
              precisión y si el sistema indica que es simulada. Se pide el
              permiso <em>solo mientras la app está en uso</em>: la app no
              sigue la ubicación en segundo plano ni fuera de esos momentos.
              También se usa para ubicar una propiedad en el mapa cuando se
              elige “Usar mi ubicación”.
            </li>
            <li>
              <strong>Fotos, videos y documentos:</strong> los que se toman o se
              eligen para una visita, un informe, un chat, una calificación o
              un producto. La app accede a la cámara y a la galería solo cuando
              tú eliges una foto o tomas una.
            </li>
            <li>
              <strong>Contenido del trabajo:</strong> visitas, tareas
              realizadas, horarios de entrada y salida, informes, mensajes de
              los chats del equipo, calificaciones de los clientes, órdenes y
              facturas.
            </li>
            <li>
              <strong>Datos del dispositivo:</strong> un identificador de la
              instalación de la app (no del teléfono ni de la persona), usado
              para detectar marcas de asistencia hechas desde el mismo
              aparato, y el token para enviarte notificaciones.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="Para qué los usamos">
          <ul className="list-disc space-y-2 pl-5">
            <li>Organizar, realizar y registrar las visitas de mantenimiento.</li>
            <li>
              Dejar constancia de cuándo y dónde se hizo el trabajo, y armar los
              informes que se entregan a cada cliente.
            </li>
            <li>La comunicación del equipo en los chats.</li>
            <li>Emitir las facturas electrónicas ante el SRI.</li>
            <li>
              Enviarte avisos: notificaciones en el teléfono, correos para elegir
              tu contraseña y mensajes de WhatsApp sobre tus visitas.
            </li>
          </ul>
          <p>
            <strong>No vendemos tus datos, no mostramos publicidad y no los
            usamos para rastrearte</strong> en otras apps o sitios.
          </p>
        </Seccion>

        <Seccion titulo="Con quién se comparten">
          <p>
            Solo con los proveedores que hacen funcionar la app, que los tratan
            por cuenta nuestra:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Vercel (alojamiento del portal y del servidor).</li>
            <li>Neon (base de datos).</li>
            <li>Cloudflare (almacenamiento de fotos, videos y documentos).</li>
            <li>Google (mapas y envío de correos).</li>
            <li>Meta (mensajes de WhatsApp).</li>
            <li>Expo (envío de notificaciones al teléfono).</li>
            <li>Upstash (protección contra abusos del inicio de sesión).</li>
          </ul>
          <p>
            Además, las facturas se envían al Servicio de Rentas Internas (SRI),
            como exige la ley. Algunos de estos proveedores guardan los datos
            fuera del Ecuador.
          </p>
        </Seccion>

        <Seccion titulo="Cuánto tiempo los guardamos">
          <p>
            Mientras la cuenta o la relación con el vivero esté activa, y
            después el tiempo que exijan las obligaciones tributarias y legales.
            Cuando se archiva a una persona, su cuenta deja de funcionar, pero
            su nombre se conserva en los registros de trabajo que hizo y en los
            informes ya entregados.
          </p>
        </Seccion>

        <Seccion titulo="Tus derechos">
          <p>
            Conforme a la Ley Orgánica de Protección de Datos Personales del
            Ecuador, puedes pedir acceder a tus datos, corregirlos, eliminarlos
            u oponerte a su tratamiento. Para pedir que se elimine tu cuenta y
            tus datos, escríbenos a{" "}
            <a className="font-medium text-green-700 underline" href={`mailto:${CONTACTO}`}>
              {CONTACTO}
            </a>{" "}
            desde el correo o el teléfono registrados, o pídeselo a un
            administrador del vivero. Respondemos en un plazo máximo de 15 días.
          </p>
        </Seccion>

        <Seccion titulo="Seguridad">
          <p>
            Las conexiones van cifradas, las contraseñas se guardan con un hash
            que no se puede revertir y el certificado de firma electrónica se
            guarda cifrado. Cada persona ve solo lo que le corresponde a su
            rol: el personal de campo, las visitas que tiene asignadas; un
            cliente, las suyas.
          </p>
        </Seccion>

        <Seccion titulo="Cambios a esta política">
          <p>
            Si cambia algo importante, actualizamos esta página y su fecha. Para
            cualquier pregunta, escríbenos a{" "}
            <a className="font-medium text-green-700 underline" href={`mailto:${CONTACTO}`}>
              {CONTACTO}
            </a>
            .
          </p>
        </Seccion>
      </article>
    </main>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
      {children}
    </section>
  );
}

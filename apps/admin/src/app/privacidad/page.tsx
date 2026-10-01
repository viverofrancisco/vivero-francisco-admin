import type { Metadata } from "next";
import { Brand } from "@/components/layout/brand";
import { getEmpresaConfig } from "@/lib/services/empresa-config.service";

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

/** El índice de la izquierda; cada `id` es el de su `Seccion`. */
const SECCIONES = [
  { id: "quien-usa-la-app", titulo: "Quién usa la app" },
  { id: "que-datos-recogemos", titulo: "Qué datos recogemos" },
  { id: "para-que-los-usamos", titulo: "Para qué los usamos" },
  { id: "con-quien-se-comparten", titulo: "Con quién se comparten" },
  { id: "cuanto-tiempo-los-guardamos", titulo: "Cuánto tiempo los guardamos" },
  { id: "tus-derechos", titulo: "Tus derechos" },
  { id: "eliminar-tu-cuenta", titulo: "Eliminar tu cuenta" },
  { id: "seguridad", titulo: "Seguridad" },
  { id: "cambios-a-esta-politica", titulo: "Cambios a esta política" },
];


export default async function PrivacidadPage() {
  const empresa = await getEmpresaConfig();
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      {/* Los saltos del índice, suaves. */}
      <style>{"html{scroll-behavior:smooth}"}</style>
      <div className="mx-auto flex max-w-5xl gap-8">
        {/* El índice fijo a la izquierda en pantallas anchas; en el teléfono va
            arriba del texto, dentro de la tarjeta. */}
        <nav className="sticky top-10 hidden h-fit w-56 flex-none lg:block" aria-label="Secciones">
          {/* En computadora el logo va acá, encabezando el índice; en el
              teléfono, arriba del texto. */}
          <div className="mb-6 px-3">
            <Brand logoUrl={empresa.logoUrl} nombre={empresa.nombre} />
          </div>
          <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            En esta página
          </p>
          <ul className="space-y-0.5 text-sm">
            {SECCIONES.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-lg px-3 py-1.5 text-gray-600 hover:bg-white hover:text-gray-900"
                >
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      <article className="min-w-0 flex-1 space-y-6 rounded-2xl bg-white p-6 text-[15px] leading-relaxed text-gray-700 shadow-sm md:p-10">
        <header className="space-y-1">
          {/* El logo de *Empresa*, el mismo del portal: esta página es lo que
              ven las tiendas y quien llega desde ellas. */}
          <div className="mb-6 flex justify-center border-b pb-6 lg:hidden">
            <Brand logoUrl={empresa.logoUrl} nombre={empresa.nombre} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Política de privacidad</h1>
          <p className="text-sm text-gray-500">
            Vivero Francisco · Última actualización: {ACTUALIZADA}
          </p>
        </header>

        <nav className="rounded-xl bg-gray-50 p-4 lg:hidden" aria-label="Secciones">
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            En esta página
          </p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {SECCIONES.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-green-700 hover:underline">
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <p>
          Esta política explica qué datos personales recogen la aplicación móvil{" "}
          <strong>Vivero Francisco</strong> y el portal{" "}
          <strong>admin.viverofrancisco.com</strong> (juntos, “la app”), para qué
          los usamos y qué derechos tienes sobre ellos. El responsable del
          tratamiento es <strong>Viverofrancisco S.A.S.</strong>, en Guayaquil,
          Ecuador.
        </p>

        <Seccion id="quien-usa-la-app" titulo="Quién usa la app">
          <p>
            La app es una herramienta de trabajo del vivero. La usan su equipo
            —administradores, staff y personal de campo— y sus clientes, para
            ver sus visitas de mantenimiento. No es una red social ni una tienda
            abierta al público: las cuentas las crea un administrador del
            vivero, y cada persona elige su propia contraseña con un enlace de
            un solo uso. No está dirigida a menores de edad.
          </p>
        </Seccion>

        <Seccion id="que-datos-recogemos" titulo="Qué datos recogemos">
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

        <Seccion id="para-que-los-usamos" titulo="Para qué los usamos">
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

        <Seccion id="con-quien-se-comparten" titulo="Con quién se comparten">
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

        <Seccion id="cuanto-tiempo-los-guardamos" titulo="Cuánto tiempo los guardamos">
          <p>
            Mientras la cuenta o la relación con el vivero esté activa, y
            después el tiempo que exijan las obligaciones tributarias y legales.
            Cuando se archiva a una persona, su cuenta deja de funcionar, pero
            su nombre se conserva en los registros de trabajo que hizo y en los
            informes ya entregados.
          </p>
        </Seccion>

        <Seccion id="tus-derechos" titulo="Tus derechos">
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

        {/* Lo que pide Google Play para la "URL de eliminación de cuenta": el
            nombre de la app, los pasos, qué se borra y qué se conserva. */}
        <Seccion id="eliminar-tu-cuenta" titulo="Eliminar tu cuenta">
          <p>
            Puedes pedir que se elimine tu cuenta de la app{" "}
            <strong>Vivero Francisco</strong> y los datos asociados en cualquier
            momento:
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Escribe a{" "}
              <a className="font-medium text-green-700 underline" href={`mailto:${CONTACTO}?subject=Eliminar%20mi%20cuenta`}>
                {CONTACTO}
              </a>{" "}
              con el asunto “Eliminar mi cuenta”, desde el correo registrado, o
              pídeselo a un administrador del vivero.
            </li>
            <li>Indica tu nombre y el usuario, correo o teléfono con el que entras.</li>
            <li>
              Confirmamos que eres tú y eliminamos la cuenta en un plazo máximo de
              15 días; te avisamos cuando esté hecho.
            </li>
          </ol>
          <p>
            <strong>Se elimina:</strong> la cuenta y su acceso, la contraseña,
            el correo y el teléfono, el identificador del dispositivo y el token
            de notificaciones, y las fotos y mensajes que no formen parte de un
            registro de trabajo.
          </p>
          <p>
            <strong>Se conserva</strong>, por obligación legal o porque forma
            parte de documentos ya entregados: las facturas emitidas (el tiempo
            que exige el SRI, hasta 7 años) y, en los registros de visitas e
            informes ya entregados a los clientes, el nombre de quien hizo el
            trabajo, con sus horarios y la ubicación de sus marcas.
          </p>
        </Seccion>

        <Seccion id="seguridad" titulo="Seguridad">
          <p>
            Las conexiones van cifradas, las contraseñas se guardan con un hash
            que no se puede revertir y el certificado de firma electrónica se
            guarda cifrado. Cada persona ve solo lo que le corresponde a su
            rol: el personal de campo, las visitas que tiene asignadas; un
            cliente, las suyas.
          </p>
        </Seccion>

        <Seccion id="cambios-a-esta-politica" titulo="Cambios a esta política">
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
      </div>
    </main>
  );
}

function Seccion({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-2">
      <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
      {children}
    </section>
  );
}

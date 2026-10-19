import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  direccionDeUbicacion,
  textoDePrecio,
  type PedidoBody,
  type PedidoInvitadoBody,
  type UbicacionDeRetiro,
} from "@vivero/shared";
import { ApiError, apiRequest, mensajeDeError } from "@vivero/app-ui/lib/api";
import { useCarrito } from "@/lib/carrito";
import type { ClienteProfileResponse, PropiedadResumen } from "@vivero/app-ui/lib/types";
import {
  BotonComoLlegar,
  ElegirDireccion,
  HorarioPlegable,
  TarjetaDeLugar,
  camposDeOtra,
  comoLlegar,
  direccionInicial,
  direccionLista,
  lineaDeDireccion,
  type Direccion,
} from "@/components/pedidos/LugarDeTrabajo";
import { EncabezadoDePasos } from "@vivero/app-ui/components/ui/EncabezadoDePasos";
import { tema } from "@vivero/app-ui/lib/tema";

type Metodo = "RETIRO" | "ENVIO";

const dinero = (n: number) => `$${n.toFixed(2)}`;

/**
 * El *checkout* en dos pasos, como el de una tienda:
 *
 * 1. **¿Cómo lo recibes?** —*Retiro en el vivero* o *Envío a domicilio*—, y
 *    debajo, dónde: las ubicaciones del vivero con su dirección y horario
 *    (*Configuración → Ubicaciones*), o sus propiedades y *Otra dirección*
 *    con el pin en el mapa.
 * 2. **Resumen**: la entrega con su dirección, lo que pide con su total, unas
 *    notas y *Realizar pedido*, abajo —el encabezado, en este paso, no lleva
 *    acción: dos botones para lo mismo sobraban—.
 *
 * No hay pago: el vivero confirma y lo coordina.
 *
 * **El invitado compra igual** (`invitado`): el paso 1 empieza por *Tus
 * datos* —nombre, teléfono y correo—, porque sin cuenta no hay a
 * quién avisarle; recibe en el vivero o en *Otra dirección* (no tiene
 * propiedades) y el pedido va a `/api/mobile/publico/pedidos`, que le crea su
 * ficha. Su *Continuar* está siempre prendido, como el de la solicitud: al
 * tocarlo con algo pendiente se marca en rojo y la pantalla va hasta ahí.
 */
export function PantallaDeConfirmar({ invitado = false }: { invitado?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lineas = useCarrito((s) => s.lineas);
  const vaciar = useCarrito((s) => s.vaciar);

  const [paso, setPaso] = useState(0);
  const [cargado, setCargado] = useState(false);
  const [propiedades, setPropiedades] = useState<PropiedadResumen[]>([]);
  // Al elegir *Otra dirección* sus campos salen debajo, al pie: se sube
  // hasta su tarjeta para que se vean sin tener que adivinar que hay más.
  const scroll = useRef<ScrollView>(null);
  const yDonde = useRef(0);
  const mostrarOtra = (y: number) =>
    setTimeout(() => scroll.current?.scrollTo({ y: yDonde.current + y - 12, animated: true }), 60);
  const [ubicaciones, setUbicaciones] = useState<UbicacionDeRetiro[]>([]);
  const [metodoElegido, setMetodo] = useState<Metodo | null>(null);
  const [ubicacionId, setUbicacionId] = useState<string | null>(null);
  /** Adónde va un envío: una de sus propiedades, u otra dirección con su pin. */
  const [envio, setEnvio] = useState<Direccion | null>(null);
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Con quién hablar, solo el invitado: el cliente ya lo dice su cuenta.
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [intentado, setIntentado] = useState(false);
  const yDatos = useRef(0);
  const yMetodo = useRef(0);
  const digitos = telefono.replace(/\D/g, "").length;
  const faltaNombre = invitado && nombre.trim().length === 0;
  const faltaTelefono = invitado && digitos < 7;
  // Obligatorio: es lo que le deja crear su cuenta después y ver el pedido.
  const faltaEmail = invitado && email.trim().length === 0;
  const emailMalo = invitado && (faltaEmail || !/^\S+@\S+\.\S+$/.test(email.trim()));

  /** Sin sesión, las ubicaciones salen de la ruta pública. */
  const rutaDeRetiro = invitado ? "/api/mobile/publico/retiro" : "/api/mobile/pedidos/retiro";

  useEffect(() => {
    Promise.all([
      // El invitado no tiene perfil ni propiedades: solo *Otra dirección*.
      invitado
        ? Promise.resolve(null)
        : apiRequest<ClienteProfileResponse>("/api/mobile/clientes/me").catch(() => null),
      apiRequest<{ ubicaciones: UbicacionDeRetiro[] }>(rutaDeRetiro, {
        authenticated: !invitado,
      }).catch(() => null),
    ]).then(([perfil, retiro]) => {
      const props = perfil?.cliente.propiedades ?? [];
      const ubic = retiro?.ubicaciones ?? [];
      setPropiedades(props);
      setUbicaciones(ubic);
      // Lo más probable ya elegido: el primer vivero; la primera propiedad, o
      // sin propiedades, otra dirección.
      setUbicacionId((u) => u ?? ubic[0]?.id ?? null);
      setEnvio((d) => d ?? direccionInicial(props));
      // Si no hay dónde retirar, el envío es lo único que queda.
      if (ubic.length === 0) setMetodo((m) => m ?? "ENVIO");
      setCargado(true);
    });
  }, [invitado, rutaDeRetiro]);

  const total = lineas.reduce((n, l) => n + l.precio * l.cantidad, 0);
  const unidades = lineas.reduce((n, l) => n + l.cantidad, 0);

  const ubicacion = ubicaciones.find((u) => u.id === ubicacionId) ?? null;
  const propiedad =
    envio?.tipo === "PROPIEDAD" ? (propiedades.find((p) => p.id === envio.propiedadId) ?? null) : null;
  const otra = envio?.tipo === "OTRA" ? envio : null;

  /** Lo que el paso 1 tiene que dejar resuelto para seguir. */
  const entregaLista =
    metodoElegido === "RETIRO"
      ? ubicacion !== null
      : metodoElegido === "ENVIO"
        ? direccionLista(envio, propiedades)
        : false;

  function entregaDelPedido(): PedidoBody["entrega"] | null {
    if (metodoElegido === "RETIRO" && ubicacion) return { tipo: "RETIRO", ubicacionId: ubicacion.id };
    if (metodoElegido === "ENVIO" && propiedad) return { tipo: "PROPIEDAD", propiedadId: propiedad.id };
    if (metodoElegido === "ENVIO" && otra?.punto) {
      return {
        tipo: "UBICACION",
        ...camposDeOtra(otra),
        lat: otra.punto.lat,
        lng: otra.punto.lng,
        guardar: otra.guardar,
      };
    }
    return null;
  }

  /**
   * *Continuar* del invitado: con algo pendiente, lo marca y va al primero
   * —sus datos, después cómo lo recibe y, con otra dirección, sus campos—.
   */
  /**
   * Como el checkout de invitado de Shopify, el correo puede ser cualquiera:
   * si ya es de un cliente, el pedido va a su ficha (`crearPedidoDeInvitado`).
   * Quien tiene cuenta puede entrar con ella desde arriba de *Tus datos*.
   */
  function irACuenta(destino: "login" | "registro") {
    router.dismissAll();
    if (destino === "login") router.replace("/(auth)/login");
    else
      router.push({
        pathname: "/(auth)/registro",
        params: { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() },
      });
  }

  async function continuar() {
    // Para todos, con o sin cuenta: lo que falta se marca en rojo y la
    // pantalla va hasta ahí. Apagado, el botón no decía qué faltaba —y sin
    // elegir la forma de entrega no pasaba nada al tocarlo—.
    const faltanDatos =
      invitado && (faltaNombre || faltaTelefono || emailMalo);
    if (faltanDatos || !entregaLista) {
      setIntentado(true);
      Keyboard.dismiss();
      const y =
        faltanDatos
          ? yDatos.current
          : metodoElegido === "ENVIO"
            ? yDonde.current
            : yMetodo.current;
      setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }), 60);
      return;
    }
    if (!invitado) {
      setPaso(1);
      return;
    }
    setPaso(1);
  }

  async function pedir() {
    const entrega = entregaDelPedido();
    if (!entrega || enviando || lineas.length === 0) return;
    setEnviando(true);
    try {
      const pedido = {
        lineas: lineas.map((l) => ({ varianteId: l.varianteId, cantidad: l.cantidad })),
        entrega,
        notas: notas.trim() || undefined,
      } satisfies PedidoBody;
      const r = invitado
        ? await apiRequest<{ id: string; numero: number }>("/api/mobile/publico/pedidos", {
            method: "POST",
            authenticated: false,
            body: {
              ...pedido,
              contacto: {
                nombre: nombre.trim(),
                telefono: telefono.trim(),
                email: email.trim(),
              },
            } satisfies PedidoInvitadoBody,
          })
        : await apiRequest<{ id: string; numero: number }>("/api/mobile/pedidos", {
            method: "POST",
            body: pedido,
          });
      vaciar();
      router.dismissAll();
      if (invitado) {
        // Sin cuenta no hay pestaña Pedidos: vuelve al catálogo.
        router.replace("/(invitado)/(tabs)/catalogo");
        // Sin cuenta no hay pestaña Pedidos: se le ofrece crear una con sus
        // datos. Con el mismo correo queda en la ficha que nació con este
        // pedido, y lo ve en Pedidos.
        Alert.alert(
          `Recibimos tu pedido #${r.numero}`,
          "El vivero te contactará para confirmarlo y coordinar el pago y la entrega. Crea tu cuenta para seguirlo desde la app.",
          [
            { text: "Ahora no", style: "cancel" },
            {
              text: "Crear cuenta",
              onPress: () =>
                router.push({
                  pathname: "/(auth)/registro",
                  params: {
                    nombre: nombre.trim(),
                    email: email.trim(),
                    telefono: telefono.trim(),
                  },
                }),
            },
          ]
        );
      } else {
        router.replace("/(cliente)/solicitudes");
        Alert.alert(
          `Recibimos tu pedido #${r.numero}`,
          "Te avisaremos cuando el vivero lo confirme. Puedes seguirlo en Pedidos."
        );
      }
    } catch (e) {
      const mensaje = mensajeDeError(e, "Intenta de nuevo en un momento.");
      // 409: algo cambió mientras confirmaba. Se dice qué y se lleva adonde
      // se arregla, en vez de dejarlo frente al mismo botón.
      if (e instanceof ApiError && e.status === 409 && metodoElegido === "RETIRO" && /retiro/i.test(mensaje)) {
        // El lugar dejó de recibir retiros: se vuelve a pedir la lista y al
        // paso 1, con el primero que sí quede ya elegido.
        const r = await apiRequest<{ ubicaciones: UbicacionDeRetiro[] }>(rutaDeRetiro, {
          authenticated: !invitado,
        }).catch(() => null);
        const ubic = r?.ubicaciones ?? [];
        setUbicaciones(ubic);
        setUbicacionId(ubic[0]?.id ?? null);
        if (ubic.length === 0) setMetodo("ENVIO");
        setPaso(0);
        Alert.alert("Ese lugar ya no recibe retiros", mensaje);
      } else if (e instanceof ApiError && e.status === 409) {
        // Se acabó el stock de algo: a ajustar el carrito.
        Alert.alert("Se acabó algo de tu pedido", mensaje, [
          { text: "Cerrar", style: "cancel" },
          { text: "Ir al carrito", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("No pudimos hacer tu pedido", mensaje);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.pantalla}>
      <EncabezadoDePasos
        paso={paso}
        total={2}
        onAtras={() => (paso === 0 ? router.back() : setPaso(0))}
        // En el resumen el botón es el de abajo, *Realizar pedido*: dos para lo
        // mismo sobraban.
        accion={paso === 0 ? "Continuar" : undefined}
        onAccion={paso === 0 ? continuar : undefined}
        // Siempre prendido: apagado no decía qué faltaba (ver `continuar`).
        deshabilitado={false}
        cargando={enviando}
      />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        {paso === 0 && !cargado ? (
          // Hasta tener los viveros y sus propiedades no se muestra nada:
          // *Retiro* aparecía medio segundo después que *Envío*, y quien ya
          // había tocado envío veía cambiar la pantalla bajo el dedo.
          <View style={styles.cargando}>
            <ActivityIndicator color={tema.verde} />
          </View>
        ) : paso === 0 ? (
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.cuerpo}
            keyboardShouldPersistTaps="handled"
          >
            {invitado ? (
              <View onLayout={(e) => (yDatos.current = e.nativeEvent.layout.y)} style={styles.datos}>
                <Text style={styles.titulo}>Tus datos</Text>
                {/* Como Shopify: quien ya tiene cuenta entra desde acá, y su
                    carrito lo sigue (se suma al de la cuenta). */}
                <Text style={styles.yaTengo}>
                  ¿Ya tienes cuenta?{" "}
                  <Text style={styles.enlaceCorreo} onPress={() => irACuenta("login")}>
                    Iniciar sesión
                  </Text>
                </Text>
                {/* El correo primero, como el checkout de Shopify: es lo que
                    ata el pedido a una ficha. */}
                <TextInput
                  mode="outlined"
                  label="Correo *"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  error={intentado && emailMalo}
                />
                <HelperText
                  type={intentado && emailMalo ? "error" : "info"}
                  visible
                  style={styles.ayudaCampo}
                >
                  {intentado && emailMalo
                    ? faltaEmail
                      ? "Escribe tu correo."
                      : "Escribe un correo válido."
                    : "Con tu correo puedes crear tu cuenta después y seguir tu pedido."}
                </HelperText>
                <TextInput
                  mode="outlined"
                  label="Nombre *"
                  value={nombre}
                  onChangeText={setNombre}
                  autoComplete="name"
                  textContentType="name"
                  error={intentado && faltaNombre}
                />
                {intentado && faltaNombre ? (
                  <HelperText type="error" visible style={styles.ayudaCampo}>
                    Escribe tu nombre.
                  </HelperText>
                ) : null}
                <TextInput
                  mode="outlined"
                  label="Teléfono *"
                  value={telefono}
                  onChangeText={setTelefono}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  error={(digitos > 0 || intentado) && faltaTelefono}
                />
                {(digitos > 0 || intentado) && faltaTelefono ? (
                  <HelperText type="error" visible style={styles.ayudaCampo}>
                    {digitos === 0 ? "Campo obligatorio." : "Escribe un teléfono válido."}
                  </HelperText>
                ) : null}
              </View>
            ) : null}
            <View onLayout={(e) => (yMetodo.current = e.nativeEvent.layout.y)}>
              <Text style={styles.titulo}>¿Cómo lo recibes?</Text>
            </View>
            {ubicaciones.length > 0 ? (
              <TarjetaDeMetodo
                icono="storefront-outline"
                titulo="Retiro en el vivero"
                detalle="Pasas a buscarlo cuando te avisemos que está listo."
                activa={metodoElegido === "RETIRO"}
                error={intentado && !metodoElegido}
                onPress={() => setMetodo("RETIRO")}
              />
            ) : null}
            <TarjetaDeMetodo
              icono="car-outline"
              titulo="Envío a domicilio"
              detalle={invitado ? "A la dirección que escribas." : "A una de tus propiedades o a otra dirección."}
              activa={metodoElegido === "ENVIO"}
              error={intentado && !metodoElegido}
              onPress={() => setMetodo("ENVIO")}
            />
            {intentado && !metodoElegido ? (
              <HelperText type="error" visible style={styles.ayudaCampo}>
                Elige cómo lo recibes.
              </HelperText>
            ) : null}

            {metodoElegido === "RETIRO" ? (
              <>
                <Text style={styles.rotulo}>¿DÓNDE LO RETIRAS?</Text>
                <View style={styles.tarjetas}>
                  {ubicaciones.map((u) => (
                    <TarjetaDeLugar
                      key={u.id}
                      activa={u.id === ubicacionId}
                      titulo={u.nombre}
                      datos={[
                        { icono: "location-outline", texto: direccionDeUbicacion(u) },
                        { icono: "flag-outline", texto: u.referencia },
                        { icono: "call-outline", texto: u.telefono ? `Tel. ${u.telefono}` : null },
                      ]}
                      horarios={u.horarios}
                      onComoLlegar={comoLlegar(u)}
                      onPress={() => setUbicacionId(u.id)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {metodoElegido === "ENVIO" ? (
              <>
                <Text style={styles.rotulo}>¿ADÓNDE LO LLEVAMOS?</Text>
                <View onLayout={(e) => (yDonde.current = e.nativeEvent.layout.y)}>
                  <ElegirDireccion
                    propiedades={propiedades}
                    valor={envio}
                    onCambio={setEnvio}
                    onElegirOtra={mostrarOtra}
                    marcarFaltantes={intentado}
                    sinGuardar={invitado}
                  />
                </View>
              </>
            ) : null}
          </ScrollView>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled">
              <Text style={styles.titulo}>Resumen del pedido</Text>

              {invitado ? (
                <>
                  <View style={styles.seccionCabeza}>
                    <Text style={styles.rotulo}>TUS DATOS</Text>
                    <Pressable onPress={() => setPaso(0)} hitSlop={8}>
                      <Text style={styles.cambiar}>Cambiar</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.caja, styles.entrega]}>
                    <Ionicons name="person-outline" size={22} color={tema.verde} />
                    <View style={styles.flex}>
                      <Text style={styles.entregaTitulo}>{nombre.trim()}</Text>
                      <Text style={styles.entregaDetalle}>{telefono.trim()}</Text>
                      {email.trim() ? <Text style={styles.entregaDetalle}>{email.trim()}</Text> : null}
                    </View>
                  </View>
                </>
              ) : null}

              <View style={styles.seccionCabeza}>
                <Text style={styles.rotulo}>{metodoElegido === "RETIRO" ? "RETIRO" : "ENVÍO A DOMICILIO"}</Text>
                <Pressable onPress={() => setPaso(0)} hitSlop={8}>
                  <Text style={styles.cambiar}>Cambiar</Text>
                </Pressable>
              </View>
              <View style={[styles.caja, styles.entrega]}>
                <Ionicons
                  name={metodoElegido === "RETIRO" ? "storefront-outline" : "location-outline"}
                  size={22}
                  color={tema.verde}
                />
                <View style={styles.flex}>
                  {metodoElegido === "RETIRO" && ubicacion ? (
                    <>
                      <Text style={styles.entregaTitulo}>{ubicacion.nombre}</Text>
                      {direccionDeUbicacion(ubicacion) ? (
                        <Text style={styles.entregaDetalle}>{direccionDeUbicacion(ubicacion)}</Text>
                      ) : null}
                      {ubicacion.referencia ? (
                        <Text style={styles.entregaDetalle}>{ubicacion.referencia}</Text>
                      ) : null}
                      {ubicacion.telefono ? (
                        <Text style={styles.entregaDetalle}>Tel. {ubicacion.telefono}</Text>
                      ) : null}
                      <HorarioPlegable horarios={ubicacion.horarios} />
                      {comoLlegar(ubicacion) ? <BotonComoLlegar onPress={comoLlegar(ubicacion)!} /> : null}
                    </>
                  ) : propiedad ? (
                    <>
                      <Text style={styles.entregaTitulo}>{propiedad.nombre}</Text>
                      {lineaDeDireccion(propiedad) ? (
                        <Text style={styles.entregaDetalle}>{lineaDeDireccion(propiedad)}</Text>
                      ) : null}
                      {propiedad.referencia ? (
                        <Text style={styles.entregaDetalle}>{propiedad.referencia}</Text>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Text style={styles.entregaTitulo}>Otra dirección</Text>
                      <Text style={styles.entregaDetalle}>
                        {otra ? lineaDeDireccion(otra) : null}
                      </Text>
                      {otra?.referencia.trim() ? (
                        <Text style={styles.entregaDetalle}>{otra.referencia.trim()}</Text>
                      ) : null}
                    </>
                  )}
                </View>
              </View>

              <Text style={styles.rotulo}>
                {unidades === 1 ? "1 PRODUCTO" : `${unidades} PRODUCTOS`}
              </Text>
              <View style={styles.caja}>
                {lineas.map((l, i) => (
                  <View
                    key={l.varianteId}
                    style={[styles.linea, i < lineas.length - 1 && styles.divisor]}
                  >
                    <View style={styles.miniatura}>
                      {l.imagenUrl ? (
                        <Image source={l.imagenUrl} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
                      ) : (
                        <Ionicons name="leaf-outline" size={18} color={tema.texto3} />
                      )}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.lineaNombre} numberOfLines={2}>
                        {l.nombre}
                      </Text>
                      <Text style={styles.lineaDetalle}>
                        {[l.variante, `${l.cantidad} × ${textoDePrecio(l.precio)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                    <Text style={styles.lineaTotal}>
                      {l.precio === 0 ? "Gratis" : dinero(l.precio * l.cantidad)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.totalFila}>
                <Text style={styles.totalRotulo}>Total</Text>
                <Text style={styles.total}>{dinero(total)}</Text>
              </View>
              <Text style={styles.ayuda}>Incluye IVA.</Text>

              <Text style={styles.rotulo}>NOTAS</Text>
              <TextInput
                mode="outlined"
                value={notas}
                onChangeText={setNotas}
                placeholder="Algo que debamos saber (opcional)"
                multiline
                style={styles.notas}
              />
              <Text style={styles.ayuda}>
                No se cobra nada ahora: el vivero confirma tu pedido y coordina contigo el pago
                {metodoElegido === "RETIRO" ? " y el retiro." : " y la entrega."}
              </Text>
            </ScrollView>
            <View style={[styles.pie, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Button
                mode="contained"
                onPress={pedir}
                loading={enviando}
                disabled={enviando || !entregaLista}
                contentStyle={styles.botonContenido}
                style={styles.boton}
              >
                Realizar pedido
              </Button>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Una de las dos formas de recibirlo: una tarjeta grande con su ícono. */
function TarjetaDeMetodo({
  icono,
  titulo,
  detalle,
  activa,
  error = false,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalle: string;
  activa: boolean;
  /** Se tocó *Continuar* sin elegir ninguna: el borde en rojo. */
  error?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.metodo,
        activa && styles.metodoActivo,
        error && styles.metodoError,
        pressed && styles.tocado,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: activa }}
    >
      <Ionicons name={icono} size={26} color={activa ? tema.verde : tema.texto2} />
      <View style={styles.flex}>
        <Text style={[styles.metodoTitulo, activa && styles.metodoTituloActivo]}>{titulo}</Text>
        <Text style={styles.metodoDetalle}>{detalle}</Text>
      </View>
      <Ionicons
        name={activa ? "radio-button-on" : "radio-button-off"}
        size={22}
        color={activa ? tema.verde : tema.texto3}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cargando: { flex: 1, alignItems: "center", justifyContent: "center" },
  datos: { gap: 10, marginBottom: 6 },
  /** El aviso pegado al campo que señala. */
  ayudaCampo: { marginTop: -8 },
  pantalla: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  cuerpo: { padding: 16, paddingBottom: 40, gap: 10 },
  titulo: { color: tema.texto, fontSize: 22, fontWeight: "700", marginBottom: 4 },
  rotulo: { color: tema.texto3, fontSize: 11, letterSpacing: 0.8, paddingLeft: 4, marginTop: 10 },
  metodoError: { borderColor: tema.rojo },
  enlaceCorreo: { color: tema.verde700, fontWeight: "700" },
  yaTengo: { color: tema.texto2, fontSize: 14, marginTop: -4, marginBottom: 2 },
  metodo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.linea,
  },
  metodoActivo: { borderColor: tema.verde, borderWidth: 2, padding: 15, backgroundColor: tema.verde50 },
  metodoTitulo: { color: tema.texto, fontSize: 16, fontWeight: "600" },
  metodoTituloActivo: { color: tema.verde700 },
  metodoDetalle: { color: tema.texto2, fontSize: 13, marginTop: 2 },
  tocado: { opacity: 0.7 },
  caja: { backgroundColor: tema.fondo, borderRadius: 12, paddingHorizontal: 14 },
  tarjetas: { gap: 10 },
  lugar: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: "#fff",
    gap: 2,
  },
  lugarActivo: { borderColor: tema.verde, borderWidth: 2, padding: 13, backgroundColor: tema.verde50 },
  lugarCabeza: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  lugarTitulo: { flex: 1, color: tema.texto, fontSize: 16, fontWeight: "600" },
  lugarTituloActivo: { color: tema.verde700 },
  horario: { marginTop: 6 },
  horarioBoton: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" },
  horarioBotonTexto: { color: tema.verde, fontSize: 13, fontWeight: "600" },
  horarioFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingLeft: 19 },
  horarioDia: { color: tema.texto2, fontSize: 13 },
  horarioHoras: { color: tema.texto, fontSize: 13, fontVariant: ["tabular-nums"] },
  horarioCerrado: { color: tema.texto3 },
  divisor: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tema.linea },
  opcionTitulo: { color: tema.texto },
  opcionDetalle: { color: tema.texto3, fontSize: 13, marginTop: 2 },
  dato: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 3 },
  datoIcono: { marginTop: 3 },
  datoTexto: { flex: 1, marginTop: 0 },
  llegar: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 8,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: tema.verde,
    backgroundColor: "#fff",
  },
  llegarTexto: { color: tema.verde, fontSize: 13, fontWeight: "600" },
  otra: { gap: 8, marginTop: 4 },
  ayuda: { color: tema.texto3, fontSize: 12, paddingHorizontal: 4 },
  seccionCabeza: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  cambiar: { color: tema.verde, fontWeight: "600", fontSize: 14, paddingRight: 4 },
  entrega: { flexDirection: "row", gap: 12, paddingVertical: 14, alignItems: "flex-start" },
  entregaTitulo: { color: tema.texto, fontSize: 16, fontWeight: "600" },
  entregaDetalle: { color: tema.texto2, fontSize: 14, marginTop: 2 },
  linea: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  miniatura: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  lineaNombre: { color: tema.texto, fontSize: 14, fontWeight: "600" },
  lineaDetalle: { color: tema.texto3, fontSize: 13, marginTop: 1 },
  lineaTotal: { color: tema.texto, fontWeight: "600" },
  totalFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 4,
    marginTop: 6,
  },
  totalRotulo: { color: tema.texto, fontSize: 16, fontWeight: "600" },
  total: { color: tema.texto, fontSize: 20, fontWeight: "700" },
  notas: { minHeight: 80 },
  pie: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
    backgroundColor: "#fff",
  },
  boton: { borderRadius: 12 },
  botonContenido: { paddingVertical: 6 },
});

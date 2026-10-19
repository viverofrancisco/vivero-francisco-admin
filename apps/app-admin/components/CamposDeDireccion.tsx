import { useState } from "react";
import { Alert } from "react-native";
import { Campo, Titulo } from "@vivero/app-ui/components/ui/Formulario";
import { BuscadorDeDireccion } from "@vivero/app-ui/components/BuscadorDeDireccion";
import {
  MapaDePropiedad,
  ZOOM_DE_BARRIO,
  zoomSegunPrecision,
  type Destino,
  type Punto,
} from "@vivero/app-ui/components/MapaDePropiedad";
import { SelectorDeCiudad } from "@vivero/app-ui/components/SelectorDeCiudad";
import { avisarFaltaUbicacion, ubicacionActual } from "@vivero/app-ui/lib/ubicacion";

export interface DireccionDeUbicacion {
  direccion: string;
  ciudad: string;
  referencia: string;
  punto: Punto | null;
}

/**
 * La dirección de una ubicación del vivero con su pin: el buscador, la calle,
 * la ciudad, la referencia y el mapa. La comparten *Nueva ubicación* y la
 * hoja *Dirección* de la ficha, para que se cargue igual en los dos lados.
 *
 * Buscar completa los campos y lleva el mapa al barrio; el pin no sale de acá.
 */
export function CamposDeDireccion({
  valor,
  onCambio,
}: {
  valor: DireccionDeUbicacion;
  onCambio: (v: DireccionDeUbicacion) => void;
}) {
  const [precision, setPrecision] = useState<number | null>(null);
  const [ubicando, setUbicando] = useState(false);
  /** A dónde llevar el mapa: lo mueven el GPS y el buscador, nunca el dedo. */
  const [destino, setDestino] = useState<Destino | null>(null);
  const set = (cambio: Partial<DireccionDeUbicacion>) => onCambio({ ...valor, ...cambio });

  const viajarA = (p: Punto, zoom: number) =>
    setDestino((d) => ({ ...p, zoom, n: (d?.n ?? 0) + 1 }));

  async function tomarUbicacion() {
    setUbicando(true);
    const res = await ubicacionActual();
    setUbicando(false);
    if (res.estado === "sin-permiso") {
      avisarFaltaUbicacion("Sin ubicación no podemos marcar dónde queda el local.", res);
      return;
    }
    if (res.estado === "sin-senal") {
      Alert.alert("No pudimos ubicarte", "Pon el punto tocando el mapa.");
      return;
    }
    const p = { lat: res.ubicacion.lat, lng: res.ubicacion.lng };
    set({ punto: p });
    setPrecision(res.ubicacion.precision);
    viajarA(p, zoomSegunPrecision(res.ubicacion.precision));
  }

  return (
    <>
      <BuscadorDeDireccion
        onElegir={(d) => {
          const cambio: Partial<DireccionDeUbicacion> = {};
          if (d.direccion) cambio.direccion = [d.direccion, d.numeroCasa].filter(Boolean).join(" ");
          if (d.ciudad) cambio.ciudad = d.ciudad;
          set(cambio);
          if (d.lat !== null && d.lng !== null) viajarA({ lat: d.lat, lng: d.lng }, ZOOM_DE_BARRIO);
        }}
      />
      <Campo label="Dirección" value={valor.direccion} onChangeText={(v) => set({ direccion: v })} />
      <SelectorDeCiudad valor={valor.ciudad} onCambio={(v) => set({ ciudad: v })} comoCampo />
      <Campo label="Referencia" value={valor.referencia} onChangeText={(v) => set({ referencia: v })} />

      <Titulo>En el mapa</Titulo>
      <MapaDePropiedad
        punto={valor.punto}
        precision={precision}
        destino={destino}
        ubicando={ubicando}
        onCambio={(p) => {
          set({ punto: p });
          setPrecision(null);
        }}
        onUsarMiUbicacion={tomarUbicacion}
      />
    </>
  );
}

import { useLocalSearchParams } from "expo-router";
import { FichaDeSolicitud } from "@/components/solicitudes/FichaDeSolicitud";

export default function SolicitudDelClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FichaDeSolicitud id={id} />;
}

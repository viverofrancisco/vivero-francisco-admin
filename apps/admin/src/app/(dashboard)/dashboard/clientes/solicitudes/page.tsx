import { redirect } from "next/navigation";

/** Solicitudes salió de Clientes y es un ítem propio del menú. */
export default function SolicitudesViejaRuta() {
  redirect("/dashboard/solicitudes");
}

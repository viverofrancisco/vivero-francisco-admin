import { useRouter } from "expo-router";
import {
  ServicioForm,
  datosDeVariante,
  type ValoresDeProducto,
} from "@/components/ServicioForm";
import { apiRequest, ApiError } from "@/lib/api";

/**
 * Dar de alta un producto, como en el portal: el producto primero, y con su
 * id la variante única recibe lo suyo —precio, costo, IVA, peso— y el stock
 * inicial entra al libro como un ingreso, nunca escribiéndole encima.
 */
export default function ServicioNuevoScreen() {
  const router = useRouter();

  async function submit(v: ValoresDeProducto) {
    try {
      const created = await apiRequest<{ id: string; varianteId: string | null }>(
        "/api/mobile/servicios",
        {
          method: "POST",
          body: {
            nombre: v.nombre,
            descripcion: v.descripcion,
            tipo: v.tipo,
            estado: v.estado,
            codigo: v.codigo,
          },
        }
      );
      if (v.variante && created.varianteId) {
        const { stockInicial } = v.variante;
        await apiRequest(`/api/mobile/variantes/${created.varianteId}`, {
          method: "PATCH",
          body: datosDeVariante(v.variante),
        });
        if (v.variante.manejaInventario && stockInicial && stockInicial > 0) {
          await apiRequest(
            `/api/mobile/variantes/${created.varianteId}/movimientos`,
            {
              method: "POST",
              body: { motivo: "INGRESO", cantidad: stockInicial, nota: "Carga inicial" },
            }
          );
        }
      }
      router.replace(`/(personal)/servicios/${created.id}`);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new Error("No pudimos crear el producto");
    }
  }

  return (
    <ServicioForm
      titulo="Nuevo producto"
      accion="Crear"
      modo="crear"
      onSubmit={submit}
    />
  );
}

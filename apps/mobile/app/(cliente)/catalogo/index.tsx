import { useRouter } from "expo-router";
import { ListaDelCatalogo } from "@/components/catalogo/ListaDelCatalogo";

export default function CatalogoScreen() {
  const router = useRouter();
  return <ListaDelCatalogo onAbrir={(id) => router.push(`/(cliente)/catalogo/${id}`)} />;
}

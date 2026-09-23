import { MessageCircle } from "lucide-react";

/**
 * Sin un chat abierto. En el teléfono no se ve —ahí está la lista—; en el
 * escritorio es la columna de la derecha esperando que se elija uno.
 */
export default function ChatsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <MessageCircle className="h-10 w-10 opacity-40" />
      <p className="text-sm font-medium">Elige un chat para leerlo</p>
    </div>
  );
}

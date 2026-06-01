import { MensajesInbox } from "@/components/mensajes/mensajes-inbox";

export default function MensajesPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mensajes</h1>
        <p className="text-sm text-muted-foreground">
          Conversaciones con clientes sobre las visitas.
        </p>
      </div>
      <MensajesInbox />
    </div>
  );
}

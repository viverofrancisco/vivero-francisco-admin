import { InboxIcon } from "lucide-react";

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = "No hay datos para mostrar" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <InboxIcon className="h-12 w-12 mb-4" />
      <p className="text-lg">{message}</p>
    </div>
  );
}

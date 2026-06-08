import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

/**
 * Docked bottom action bar for create/edit forms — fixed to the bottom of the
 * viewport, spanning the content area (offset past the `md:w-64` sidebar), so
 * Save + Cancel are always visible. Pair with bottom padding on the form
 * content (e.g. `pb-24`) so the last fields clear the bar.
 */
export function StickyFormActions({
  saveLabel = "Guardar",
  saving = false,
  onCancel,
  formId,
  disabled = false,
}: {
  saveLabel?: string;
  saving?: boolean;
  onCancel: () => void;
  /** If set, the Save button submits this form by id instead of its parent. */
  formId?: string;
  disabled?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-end gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:left-64 md:px-6">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" form={formId} disabled={saving || disabled}>
        <Check className="h-4 w-4" />
        {saving ? "Guardando..." : saveLabel}
      </Button>
    </div>
  );
}

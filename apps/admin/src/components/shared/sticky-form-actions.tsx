import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

/**
 * Sticky bottom action bar for create/edit forms — keeps Save + Cancel always
 * visible while scrolling long forms. Render it as the LAST child of the
 * centered form-content container (e.g. inside `mx-auto max-w-2xl`) so the
 * buttons align with the form card's right edge.
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
    <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-border bg-card/95 py-3 backdrop-blur">
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

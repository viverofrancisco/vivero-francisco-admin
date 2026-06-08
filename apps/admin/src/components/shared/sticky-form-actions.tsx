import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sticky bottom action bar for create/edit forms — keeps Save + Cancel always
 * visible while scrolling long forms. Place as the last child of a `<form>`
 * (or pass `formId` to submit a form by id). The `-mx-4 md:-mx-6` bleeds the
 * bar to the edges of the standard page padding (`p-4 md:p-6`).
 */
export function StickyFormActions({
  saveLabel = "Guardar",
  saving = false,
  onCancel,
  formId,
  disabled = false,
  contentClassName,
}: {
  saveLabel?: string;
  saving?: boolean;
  onCancel: () => void;
  /** If set, the Save button submits this form by id instead of its parent. */
  formId?: string;
  disabled?: boolean;
  /** Override the inner container (e.g. to center within a max-width). */
  contentClassName?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      <div className={cn("flex justify-end gap-3", contentClassName)}>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" form={formId} disabled={saving || disabled}>
          <Check className="h-4 w-4" />
          {saving ? "Guardando..." : saveLabel}
        </Button>
      </div>
    </div>
  );
}

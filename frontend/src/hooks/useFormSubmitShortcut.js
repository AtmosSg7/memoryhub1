import { useEffect } from "react";

function isTopmostDialogForm(formEl) {
  if (!formEl) return false;
  const dialog = formEl.closest('[role="dialog"]');
  if (!dialog) return true;
  const dialogs = document.querySelectorAll('[role="dialog"]');
  return dialogs.length === 0 || dialogs[dialogs.length - 1] === dialog;
}

/** Submit the bound form on ⌘/Ctrl+Enter (skipped when focus is in a textarea). */
export function useFormSubmitShortcut(formRef, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
      if (event.target?.tagName?.toLowerCase() === "textarea") return;
      if (!formRef.current || !isTopmostDialogForm(formRef.current)) return;
      event.preventDefault();
      formRef.current.requestSubmit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, formRef]);
}

import { useEffect } from "react";

function isBlockedShortcut(event) {
  const key = String(event.key || "").toLowerCase();
  const meta = event.metaKey || event.ctrlKey;

  if (!meta) return false;

  // Common browser/data-extraction shortcuts. This is deterrence only.
  return key === "s" || key === "u" || key === "p" || key === "c";
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

export default function useScopedShortcutProtection(rootRef, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (event) => {
      const root = rootRef?.current;
      if (!root) return;

      const target = event.target;
      const insideCustomizer = target instanceof Node && root.contains(target);
      if (!insideCustomizer) return;

      const key = String(event.key || "").toLowerCase();
      // Keep form UX intact (copy/shortcut behavior in inputs).
      if (key === "c" && isEditableTarget(target)) return;

      if (isBlockedShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [rootRef, enabled]);
}

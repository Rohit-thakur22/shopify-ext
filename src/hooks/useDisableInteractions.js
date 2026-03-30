import { useMemo } from "react";

function preventDefault(event) {
  event.preventDefault();
}

export default function useDisableInteractions({ enabled = true } = {}) {
  return useMemo(() => {
    if (!enabled) return {};

    return {
      onContextMenu: preventDefault,
      onDragStart: preventDefault,
      onCopy: preventDefault,
      onCut: preventDefault,
      onSelectStart: preventDefault,
      draggable: false,
      style: {
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      },
    };
  }, [enabled]);
}

import { useEffect, useState } from "react";

const COMPACT_VIEWPORT_QUERY = "(max-width: 720px)";

export default function useIsCompactViewport() {
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(COMPACT_VIEWPORT_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setIsCompactViewport(event.matches);
    };

    setIsCompactViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  return isCompactViewport;
}

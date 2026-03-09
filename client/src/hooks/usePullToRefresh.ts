import { useEffect, useRef, useState } from "react";

export function usePullToRefresh(onRefresh: () => void | Promise<void>, threshold = 80) {
    const startY = useRef(0);
    const [pulling, setPulling] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const onTouchStart = (e: TouchEvent) => {
            if (window.scrollY === 0) startY.current = e.touches[0].clientY;
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!startY.current) return;
            const diff = e.touches[0].clientY - startY.current;
            if (diff > 10 && window.scrollY === 0) setPulling(true);
        };

        const onTouchEnd = async () => {
            if (!startY.current) return;
            if (pulling) {
                setPulling(false);
                setRefreshing(true);
                try { await onRefresh(); } finally { setRefreshing(false); }
            }
            startY.current = 0;
        };

        document.addEventListener("touchstart", onTouchStart, { passive: true });
        document.addEventListener("touchmove", onTouchMove, { passive: true });
        document.addEventListener("touchend", onTouchEnd);

        return () => {
            document.removeEventListener("touchstart", onTouchStart);
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onTouchEnd);
        };
    }, [onRefresh, pulling, threshold]);

    return { pulling, refreshing };
}

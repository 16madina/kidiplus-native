import { useEffect, useState } from "react";
import { fetchLiveProducts, type LiveProductRow } from "./live-host";
import { supabase } from "./supabase";

/** Opponent live products for the right mini-card. */
export function useBattlePeerProducts(liveId: string | null) {
  const [products, setProducts] = useState<LiveProductRow[]>([]);

  useEffect(() => {
    if (!liveId) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void fetchLiveProducts(liveId).then((rows) => {
        if (!cancelled) setProducts(rows);
      });
    };
    load();
    const ch = supabase
      .channel(`battle-peer-products:${liveId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_products", filter: `live_id=eq.${liveId}` },
        load,
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [liveId]);

  return products;
}

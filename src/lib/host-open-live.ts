type LiveIdCb = (liveId?: string | null) => void;

function makeBus() {
  const subs = new Set<LiveIdCb>();
  return {
    emit(liveId?: string | null) {
      for (const cb of [...subs]) cb(liveId);
    },
    subscribe(cb: LiveIdCb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}

const resumeBus = makeBus();
const endedBus = makeBus();

/** Home / Live-tab banner or a push tap → reopen the host studio. */
export function requestResumeHostLive(liveId?: string | null) {
  resumeBus.emit(liveId ?? null);
}

/** Hide dangling banners immediately after a proper Finish. */
export function notifyHostLiveEnded(liveId?: string | null) {
  endedBus.emit(liveId ?? null);
}

export function subscribeResumeHostLive(cb: LiveIdCb) {
  return resumeBus.subscribe(cb);
}

export function subscribeHostLiveEnded(cb: LiveIdCb) {
  return endedBus.subscribe(cb);
}

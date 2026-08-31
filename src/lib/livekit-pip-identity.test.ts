import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { livePipViewerIdentity } from "./livekit-identity.ts";

const LIVEKIT_IDENTITY_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const GUEST_IDENTITY_RE = /^guest_[a-zA-Z0-9_-]{1,64}$/;

function run() {
  const signed = livePipViewerIdentity("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  assert.equal(signed, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-pip");
  assert.match(signed, LIVEKIT_IDENTITY_RE);
  assert.notEqual(signed, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");

  const guest = livePipViewerIdentity(null);
  assert.match(guest, GUEST_IDENTITY_RE);
  assert.match(guest, /^guest_pip_/);

  const guest2 = livePipViewerIdentity(undefined);
  assert.match(guest2, GUEST_IDENTITY_RE);
  assert.notEqual(guest, guest2);

  const video = readFileSync(new URL("../components/live/LiveKitRemoteVideo.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(video, /iosPIP/, "host VideoTrack must not use LiveKit iosPIP");
  assert.doesNotMatch(video, /hostIosPipConfig/);

  const session = readFileSync(new URL("../../modules/kidi-live-pip/ios/LivePipSession.swift", import.meta.url), "utf8");
  assert.doesNotMatch(session, /import Capacitor/);
  assert.match(session, /AVPictureInPictureController/);
  assert.match(session, /func setEligible/);
  assert.match(session, /willResignActiveNotification/);
  assert.match(session, /backgroundAudioArmed/);
  assert.match(session, /setRemoteAudioSubscribed\(false, reason: "didBecomeActive"\)/);
  assert.match(session, /ConnectOptions\(autoSubscribe: false\)/);
  assert.match(session, /ensureRemoteVideoSubscribed/);
  assert.match(session, /already connected/);
  assert.match(session, /prepareForBackgroundPip skipped/);

  const expoMod = readFileSync(new URL("../../modules/kidi-live-pip/ios/KidiLivePipModule.swift", import.meta.url), "utf8");
  assert.match(expoMod, /DispatchQueue.main.async/);
  assert.match(expoMod, /attachOnMain/);
  assert.match(expoMod, /Name\("KidiLivePip"\)/);
  assert.match(expoMod, /setEligible/);
  assert.match(expoMod, /keyWindowRootView/);

  const cfg = JSON.parse(
    readFileSync(new URL("../../modules/kidi-live-pip/expo-module.config.json", import.meta.url), "utf8"),
  ) as { platforms: string[]; apple?: { modules: string[] } };
  assert.ok(cfg.platforms.includes("apple"));
  assert.ok(cfg.apple?.modules.includes("KidiLivePipModule"));

  const js = readFileSync(new URL("./live-pip.ts", import.meta.url), "utf8");
  assert.match(js, /livePipViewerIdentity/);
  assert.match(js, /url: lk\.url/);
  assert.match(js, /token: lk\.token/);
  assert.match(js, /muteRnViewerAudio/);
  assert.match(js, /iosReadyRef/);

  const plugin = readFileSync(new URL("../../plugins/withLiveKitIos.js", import.meta.url), "utf8");
  assert.match(plugin, /KidiLivePip/);

  console.log("livekit-pip-identity.test.ts ok");
}

run();

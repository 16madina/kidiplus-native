import assert from "node:assert/strict";
import {
  canAttemptKitPublish,
  hostPipelineMode,
  kitPublishConfirmed,
  runFilteredPublish,
  type KitPublishDeps,
} from "./host-pipeline-logic.ts";

function fakeDeps(overrides: Partial<KitPublishDeps> = {}): KitPublishDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    os: "android",
    cameraKit: true,
    confirmAttempts: 1,
    confirmDelayMs: 0,
    sleep: async () => undefined,
    startPreview: async () => {
      calls.push("preview");
    },
    setPublish: async (opts) => {
      calls.push(opts.enabled ? `publish:${opts.roomUrl}:${opts.token}` : "unpublish");
    },
    getStatus: async () => ({ publishing: true, frameCount: 12 }),
    applyLens: async (lens) => {
      calls.push(`lens:${lens.lensId}`);
    },
    allowNativeLens: (allowed) => {
      calls.push(`allow:${allowed}`);
    },
    ...overrides,
    calls,
  };
}

async function main() {
  assert.equal(hostPipelineMode({ hasEffects: true, snapLens: true, cameraKit: true }), "effects");
  assert.equal(hostPipelineMode({ hasEffects: false, snapLens: true, cameraKit: true }), "snap");
  assert.equal(hostPipelineMode({ hasEffects: false, snapLens: true, cameraKit: false }), "raw");
  assert.equal(hostPipelineMode({ hasEffects: false, snapLens: false, cameraKit: true }), "raw");

  assert.equal(canAttemptKitPublish("android", true), true);
  assert.equal(canAttemptKitPublish("android", false), false);
  assert.equal(canAttemptKitPublish("ios", true), true);
  assert.equal(canAttemptKitPublish("ios", false), false);
  assert.equal(canAttemptKitPublish("web", true), false);

  assert.equal(kitPublishConfirmed({ publishing: true, frameCount: 3 }), true);
  assert.equal(kitPublishConfirmed({ publishing: true, frameCount: 0 }), false);
  assert.equal(kitPublishConfirmed({ publishing: false, frameCount: 40 }), false);
  assert.equal(kitPublishConfirmed({ ready: true }), false);
  assert.equal(kitPublishConfirmed(null), false);

  const snapLens = { lensId: "x", groupId: "g", isSnapLens: true as const };
  const args = {
    url: "wss://live.example",
    token: "tok",
    facing: "user" as const,
    lens: snapLens,
  };

  const androidOk = await runFilteredPublish(args, fakeDeps());
  assert.equal(androidOk.path, "kit_publish");

  const noLens = await runFilteredPublish({ ...args, facing: "environment", lens: null }, fakeDeps());
  assert.equal(noLens.path, "kit_publish");

  const iosOk = await runFilteredPublish(args, fakeDeps({ os: "ios" }));
  assert.equal(iosOk.path, "kit_publish");

  const iosStub = await runFilteredPublish(
    args,
    fakeDeps({ os: "ios", getStatus: async () => ({ ready: true }) }),
  );
  assert.equal(iosStub.path, "kit_failed");

  const stubStatus = await runFilteredPublish(
    args,
    fakeDeps({ getStatus: async () => ({ ready: true }) }),
  );
  assert.equal(stubStatus.path, "web_overlay");

  const failCalls: string[] = [];
  const failed = fakeDeps({
    setPublish: async (opts) => {
      if (opts.enabled) throw new Error("no frames");
      failCalls.push("unpublish");
    },
  });
  const boom = await runFilteredPublish(args, failed);
  assert.equal(boom.path, "web_overlay");
  assert.ok(failCalls.includes("unpublish"));

  const iosFailCalls: string[] = [];
  const iosFailed = fakeDeps({
    os: "ios",
    setPublish: async (opts) => {
      if (opts.enabled) throw new Error("LiveKit Swift not linked");
      iosFailCalls.push("unpublish");
    },
  });
  const iosBoom = await runFilteredPublish(args, iosFailed);
  assert.equal(iosBoom.path, "kit_failed");
  assert.ok(iosFailCalls.includes("unpublish"));

  let polls = 0;
  const lateFrames = await runFilteredPublish(
    args,
    fakeDeps({
      os: "ios",
      confirmAttempts: 4,
      confirmDelayMs: 1,
      sleep: async () => undefined,
      getStatus: async () => {
        polls += 1;
        return polls < 3
          ? { publishing: true, frameCount: 0 }
          : { publishing: true, frameCount: 5 };
      },
    }),
  );
  assert.equal(lateFrames.path, "kit_publish");
  assert.ok(polls >= 3);

  const withLens = fakeDeps();
  await runFilteredPublish(args, withLens);
  assert.ok(withLens.calls.includes("lens:x"));
  assert.ok(withLens.calls.includes("publish:wss://live.example:tok"));

  const effectsWin = fakeDeps();
  await runFilteredPublish({ ...args, hasEffects: true }, effectsWin);
  assert.equal(effectsWin.calls.includes("lens:x"), false, "effects exclude Snap lens");
  assert.equal(
    hostPipelineMode({ hasEffects: true, snapLens: true, cameraKit: true }),
    "effects",
  );

  console.log("host-pipeline: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { LocalParticipant, LocalVideoTrack, Track } from "livekit-client";

export function facingModeOf(facing: string | undefined): "user" | "environment" {
  return facing === "back" || facing === "environment" ? "environment" : "user";
}

export function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let exclusive: Promise<void> = Promise.resolve();

export function runHostCameraExclusive<T>(work: () => Promise<T>): Promise<T> {
  const run = exclusive.then(work, work);
  exclusive = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function setHostCameraEnabled(
  participant: LocalParticipant,
  enabled: boolean,
  facing: string,
): Promise<void> {
  const facingMode = facingModeOf(facing);
  if (!enabled) {
    await participant.setCameraEnabled(false).catch(() => undefined);
    return;
  }
  try {
    await participant.setCameraEnabled(true, { facingMode });
  } catch {
    try {
      const pub = participant.getTrackPublication(Track.Source.Camera);
      if (pub?.track) {
        await participant.unpublishTrack(pub.track, true);
      }
    } catch {
      /* already gone */
    }
    await delayMs(280);
    await participant.setCameraEnabled(true, { facingMode });
  }
}

export async function restartHostCamera(
  participant: LocalParticipant,
  facing: string,
): Promise<void> {
  const facingMode = facingModeOf(facing);
  const pub = participant.getTrackPublication(Track.Source.Camera);
  const track = pub?.track;
  if (track instanceof LocalVideoTrack) {
    await track.restartTrack({ facingMode });
    return;
  }
  await setHostCameraEnabled(participant, false, facing);
  await delayMs(160);
  await setHostCameraEnabled(participant, true, facing);
}

type PickerPause = <T>(work: () => Promise<T>) => Promise<T>;

let pickerPause: PickerPause | null = null;

export function registerHostPickerPause(fn: PickerPause | null): void {
  pickerPause = fn;
}

export async function withHostPickerPause<T>(work: () => Promise<T>): Promise<T> {
  if (pickerPause) return pickerPause(work);
  return work();
}

export async function pauseCameraAroundPicker<T>(
  participant: LocalParticipant,
  facing: string,
  work: () => Promise<T>,
): Promise<T> {
  return runHostCameraExclusive(async () => {
    await setHostCameraEnabled(participant, false, facing);
    await delayMs(220);
    try {
      return await work();
    } finally {
      await delayMs(420);
      await setHostCameraEnabled(participant, true, facing);
    }
  });
}

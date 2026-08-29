/** Metro alias target. Never call requireNativeModule — the iOS binary may not include it. */
export enum SaveFormat {
  JPEG = "jpeg",
  PNG = "png",
  WEBP = "webp",
}

export enum FlipType {
  Horizontal = "horizontal",
  Vertical = "vertical",
}

export async function manipulateAsync(
  uri: string,
  _actions?: unknown[],
  _saveOptions?: unknown,
): Promise<{ uri: string; width?: number; height?: number }> {
  return { uri };
}

export const ImageManipulator = {
  manipulate: (uri: string) => ({
    resize() {
      return this;
    },
    rotate() {
      return this;
    },
    flip() {
      return this;
    },
    crop() {
      return this;
    },
    extent() {
      return this;
    },
    async renderAsync() {
      return {
        async saveAsync() {
          return { uri };
        },
        release() {},
      };
    },
    release() {},
  }),
};

export function useImageManipulator() {
  return ImageManipulator.manipulate("");
}

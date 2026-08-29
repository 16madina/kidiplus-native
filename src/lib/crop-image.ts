import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { CropRect } from "./publish-media";

export async function cropCoverImage(uri: string, rect: CropRect): Promise<string> {
  const originX = Math.max(0, Math.round(rect.originX));
  const originY = Math.max(0, Math.round(rect.originY));
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const result = await manipulateAsync(
    uri,
    [{ crop: { originX, originY, width, height } }, { resize: { width: 1080 } }],
    { compress: 0.86, format: SaveFormat.JPEG },
  );
  if (!result.uri) throw new Error("crop_failed");
  return result.uri;
}

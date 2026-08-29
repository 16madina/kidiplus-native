export const PUBLISH_HUB_MODES = ["video", "photo", "story", "affiche"] as const;
export type PublishHubMode = (typeof PUBLISH_HUB_MODES)[number];

export const PUBLISH_HUB_LABEL_KEY: Record<PublishHubMode, string> = {
  video: "publish.modes.video",
  photo: "publish.modes.photo",
  story: "publish.modes.story",
  affiche: "publish.modes.affiche",
};

const { withInfoPlist, createRunOncePlugin } = require("expo/config-plugins");

/**
 * Inject Snap Camera Kit client token + default lens group into iOS Info.plist
 * (same keys as Capacitor kidiplus.com).
 */
function withCameraKitPlist(config) {
  return withInfoPlist(config, (config) => {
    const token =
      process.env.EXPO_PUBLIC_SNAP_CAMERA_KIT_API_TOKEN ||
      config.extra?.snapCameraKitApiToken ||
      "eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzg0MDQzNzkxLCJzdWIiOiIxOWJhOGM5OC1jMDRhLTRlOTgtOGVkYi04YWM4ZDQyODUzMzN-UFJPRFVDVElPTn43OTRjMjZhNC02ZDg0LTQ5NGYtOGE4Ny04MmZkMmVkZDVmYTUifQ.YE50FTWYfbngNKJGigMDb-I_eVvfASwRF9NRsQ4MD_4";
    const groupId =
      process.env.EXPO_PUBLIC_SNAP_LENS_GROUP_ID ||
      config.extra?.snapLensGroupId ||
      "df287f43-6646-4b01-a711-1a0e632c211a";

    config.modResults.SCCameraKitAPIToken = token;
    config.modResults.SCCameraKitLensGroupID = groupId;
    return config;
  });
}

module.exports = createRunOncePlugin(withCameraKitPlist, "withCameraKitPlist", "1.0.0");

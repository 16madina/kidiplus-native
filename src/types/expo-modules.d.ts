declare module "expo-tracking-transparency" {
  export function requestTrackingPermissionsAsync(): Promise<{ status: string; granted: boolean }>;
  export function getTrackingPermissionsAsync(): Promise<{ status: string; granted: boolean }>;
}

declare module "expo-local-authentication" {
  export function hasHardwareAsync(): Promise<boolean>;
  export function isEnrolledAsync(): Promise<boolean>;
  export function authenticateAsync(options?: {
    promptMessage?: string;
    fallbackLabel?: string;
    cancelLabel?: string;
    disableDeviceFallback?: boolean;
  }): Promise<{ success: boolean; error?: string }>;
}

declare module "expo-apple-authentication" {
  export const AppleAuthenticationScope: { FULL_NAME: number; EMAIL: number };
  export function signInAsync(options?: any): Promise<any>;
}

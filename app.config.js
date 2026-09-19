/**
 * Single source of truth for app configuration.
 * (Former static app.json folded in here — `npx expo doctor` requires the
 * dynamic config to either use or replace app.json, and EAS builds run the
 * same check as the "Check Expo config" build step.)
 */
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

module.exports = () => ({
  name: 'accessMap',
  slug: 'accessMap',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/final_logo.png',
  scheme: 'accessmap',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.accessmap.cainta',
    config: {
      googleMapsApiKey: GOOGLE_MAPS_KEY,
    },
  },
  android: {
    package: 'com.accessmap.cainta',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: GOOGLE_MAPS_KEY,
      },
    },
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/final_logo.png',
        imageWidth: 76,
      },
    ],
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission:
          'AccessMap uses your photos to attach facility entrance images verified by the administrator.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'AccessMap uses your current location only once to compute walking directions to a selected facility. It is never used for background tracking.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: '2b0d4df1-da19-4d37-8490-5cdfa19d8f33',
    },
  },
});

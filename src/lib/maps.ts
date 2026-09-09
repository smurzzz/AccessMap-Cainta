export const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!googleMapsApiKey && __DEV__) {
  console.warn(
    'Missing Google Maps API key. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env file.',
  );
}

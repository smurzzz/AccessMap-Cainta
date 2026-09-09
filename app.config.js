const appJson = require('./app.json');

module.exports = () => {
  const expo = appJson.expo;

  return {
    ...expo,
    ios: {
      ...expo.ios,
      config: {
        ...(expo.ios?.config || {}),
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      ...expo.android,
      config: {
        ...(expo.android?.config || {}),
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
  };
};

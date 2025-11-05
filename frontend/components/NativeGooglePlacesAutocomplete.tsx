import { Platform } from 'react-native';

// Only import on native platforms
let GooglePlacesAutocomplete: any = null;

if (Platform.OS !== 'web') {
  try {
    const lib = require('react-native-google-places-autocomplete');
    GooglePlacesAutocomplete = lib.GooglePlacesAutocomplete;
  } catch (e) {
    console.log('GooglePlacesAutocomplete not available');
  }
}

export default GooglePlacesAutocomplete;

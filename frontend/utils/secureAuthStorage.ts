import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage for auth credentials (the JWT and identifiers tied to it).
 *
 * On iOS/Android this is backed by the platform Keychain/Keystore via
 * expo-secure-store, which is encrypted at rest. expo-secure-store isn't
 * available on web, so we fall back to AsyncStorage there — web has no
 * equivalent OS-level secure enclave anyway, and this keeps behavior
 * consistent across platforms without crashing.
 */
const isWeb = Platform.OS === 'web';

export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    return isWeb ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
  async multiRemove(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.removeItem(k)));
  },
};

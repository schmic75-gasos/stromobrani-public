import { requireOptionalNativeModule } from 'expo';

const nativeModule = requireOptionalNativeModule('StromobraniIntegrity');

function requireAndroidModule() {
  if (!nativeModule) {
    throw new Error('Play Integrity je dostupné pouze v Android buildu s nativním modulem.');
  }
  return nativeModule;
}

export function prepare(cloudProjectNumber) {
  return requireAndroidModule().prepare(cloudProjectNumber);
}

export function requestToken(requestHash) {
  return requireAndroidModule().requestToken(requestHash);
}

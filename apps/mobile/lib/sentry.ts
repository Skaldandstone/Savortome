import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { dsn } from './sentry-public.json';
import { scrubMobileEvent, type DiagnosticCode } from './sentryPrivacy';

Sentry.init({
  dsn,
  enabled:!__DEV__, environment:'production',
  release:`com.skaldandstone.savortome@${Constants.expoConfig?.version ?? 'unknown'}`,
  dist:Platform.OS === 'android' ? String(Constants.expoConfig?.android?.versionCode ?? 'unknown') : Constants.expoConfig?.ios?.buildNumber,
  sendDefaultPii:false, maxBreadcrumbs:0, beforeBreadcrumb:()=>null,
  beforeSend:scrubMobileEvent,
  tracesSampleRate:0, profilesSampleRate:0,
  replaysSessionSampleRate:0, replaysOnErrorSampleRate:0,
  enableLogs:false, enableAutoSessionTracking:false,
  enableAutoPerformanceTracing:false, enableCaptureFailedRequests:false,
  attachScreenshot:false, attachViewHierarchy:false,
  enableNdk:false, enableNativeCrashHandling:true,
  // iOS JS reporting is ready; early native iOS needs its own reviewed callback.
  enableNative:Platform.OS === 'android',
  // Android starts the native SDK with its privacy callback before JS starts.
  autoInitializeNativeSdk:Platform.OS !== 'android',
  integrations:defaults=>defaults.filter(integration=>![
    'Breadcrumbs','ExpoContext','ExpoConstants','ExpoUpdatesListener','DeviceContext','MobileReplay',
  ].includes(integration.name)),
});

/** Never pass provider text, tokens, food state or receipt content as context. */
export function reportAccountFailure(code: DiagnosticCode) {
  Sentry.captureException(new Error(code), { tags:{diagnostic_code:code} });
}

export { Sentry };

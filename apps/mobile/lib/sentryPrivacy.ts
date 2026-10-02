import type { ErrorEvent } from '@sentry/react-native';

export const diagnosticCodes = ['account-startup-timeout', 'hosted-auth-failed', 'account-retry-failed', 'diagnostic-test'] as const;
export type DiagnosticCode = typeof diagnosticCodes[number];
const errorTypes = new Set(['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'URIError', 'EvalError']);
const safeFile = (value?: string) => value?.split(/[?#]/)[0]?.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]/g, '_');

/** Build an allowlisted event; never forward arbitrary SDK contexts or messages. */
export function scrubMobileEvent(event: ErrorEvent, hint?: { attachments?: unknown[] }): ErrorEvent {
  if (hint) hint.attachments = [];
  const code = diagnosticCodes.find(code => code === event.tags?.diagnostic_code);
  return {
    type:event.type,
    event_id:event.event_id, timestamp:event.timestamp, level:event.level,
    platform:event.platform, release:event.release, dist:event.dist, environment:event.environment,
    tags:{ app_surface:'mobile', ...(code ? { diagnostic_code:code } : {}) },
    exception:{values:event.exception?.values?.map(exception => ({
      type:errorTypes.has(exception.type ?? '') ? exception.type : 'Error',
      value:code ?? 'Application failure; private details withheld',
      mechanism:exception.mechanism ? {type:exception.mechanism.type,handled:exception.mechanism.handled} : undefined,
      stacktrace:{frames:exception.stacktrace?.frames?.map(frame => ({
        filename:safeFile(frame.filename), lineno:frame.lineno, colno:frame.colno,
        in_app:frame.in_app,
        function:frame.function?.replace(/[^a-zA-Z0-9_$<>. -]/g,'_').slice(0,120),
      }))},
    }))},
    debug_meta:event.debug_meta ? { images:event.debug_meta.images?.filter(image=>image.type==='sourcemap').map(image => ({
      type:'sourcemap' as const, debug_id:image.debug_id, code_file:safeFile(image.code_file) ?? 'index.android.bundle',
    })) } : undefined,
  };
}

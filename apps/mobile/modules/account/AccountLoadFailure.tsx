import { useState } from 'react';
import { Link } from 'expo-router';
import { reloadAsync } from 'expo-updates';
import { Text, View } from 'react-native';
import { Button, usePalette } from '@/ui';

/** Never turn an unavailable account service into an empty protected screen. */
export function AccountLoadFailure() {
  const c = usePalette();
  const [busy, setBusy] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const retry = async () => {
    setBusy(true);
    setRetryFailed(false);
    try {
      // Restart this app without deleting its account tokens or local data.
      await reloadAsync();
    } catch {
      setRetryFailed(true);
      setBusy(false);
    }
  };
  return <View style={{ flex:1, justifyContent:'center', padding:24, gap:20, backgroundColor:c.bg }}>
    <Text accessibilityRole="header" style={{ color:c.text, fontSize:24, fontWeight:'700' }}>We couldn’t load your account</Text>
    <Text style={{ color:c.textMuted, fontSize:16 }}>Check your connection and try again. This doesn’t mean you’ve lost your recipes. Feed me gently is available without signing in.</Text>
    <Button label={busy ? 'Restarting…' : 'Try again'} disabled={busy} onPress={() => void retry()} />
    {retryFailed && <Text accessibilityLiveRegion="polite" style={{ color:c.text, fontSize:16 }}>Please close and reopen Savortome to retry. You don’t need to uninstall it or clear its data.</Text>}
    <Link href="/care" accessibilityLabel="Open Feed me gently without signing in" style={{ color:c.accent, fontSize:16, minHeight:48, paddingVertical:16 }}>Open Feed me gently</Link>
  </View>;
}

import { Text, View } from 'react-native';
import { CareScreen } from '@/modules/care/CareScreen';
export default function CareRoute() {
  if (process.env.EXPO_PUBLIC_WOODLAND_BETA !== 'true') return <View style={{padding:30}}><Text>This screen is available in the private beta build.</Text></View>;
  return <CareScreen />;
}

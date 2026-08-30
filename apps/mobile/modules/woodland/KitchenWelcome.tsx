import { ImageBackground, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, usePalette } from '@/ui';
import { useDecoration } from '@/ui/ThemeProvider';
export function KitchenWelcome() {
  const router=useRouter(); const c=usePalette(); const {reduced,toggle}=useDecoration();
  if(process.env.EXPO_PUBLIC_WOODLAND_BETA !== 'true') return null;
  return <View style={{marginBottom:24}}><ImageBackground source={reduced ? undefined : require('../../assets/hearth.png')} imageStyle={{borderRadius:18}} style={{minHeight:reduced ? 0 : 260,justifyContent:'flex-end',borderRadius:18,overflow:'hidden',backgroundColor:c.surface}}><View style={{padding:22,backgroundColor:reduced?c.surface:'#10201beb'}}><Text style={{fontFamily:'serif',fontSize:29,color:reduced?c.text:'#f2e8d5'}}>Your woodland kitchen</Text><Text style={{color:reduced?c.textMuted:'#f2e8d5',fontSize:15,marginVertical:12}}>A place for every recipe. And whatever feels possible.</Text><Button label="Feed me gently" onPress={()=>router.push('/care')} /></View></ImageBackground><Button variant="ghost" label={reduced?'Show illustrations':'Reduce decoration'} onPress={toggle} /></View>;
}

import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, usePalette } from '@/ui';
import { useDecoration } from '@/ui/ThemeProvider';
import { woodlandEnabled } from './Artwork';

export function KitchenWelcome() {
  const router = useRouter(); const c = usePalette(); const { reduced, toggle } = useDecoration();
  const { width } = useWindowDimensions();
  if (!woodlandEnabled) return null;
  return <View style={styles.wrap}>
    <View style={[styles.frame,{backgroundColor:c.surface,borderColor:c.border}]}>
      {!reduced && <Image source={require('../../assets/woodland/kitchen-scene.webp')} accessible={false} accessibilityElementsHidden importantForAccessibility="no" fadeDuration={0} resizeMode="cover" style={{width:'100%',height:width >= 700 ? 330 : 220}} />}
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.title,{color:c.accent}]}>Your woodland kitchen</Text>
        <Text style={[styles.subtitle,{color:c.textMuted}]}>Simple food. Thoughtful moments.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/care')} style={[styles.invitation,{borderColor:c.border,backgroundColor:c.actionSurface}]}>
          <Text style={[styles.invitationText,{color:c.actionText}]}>Feed me gently</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open getting started guide" onPress={() => router.push('/getting-started')} style={[styles.guideLink,{borderColor:c.border}]}>
          <Text style={[styles.guideText,{color:c.accent}]}>New here? Let’s get your kitchen ready</Text>
        </Pressable>
      </View>
    </View>
    <Button variant="ghost" label={reduced ? 'Show illustrations' : 'Reduce decoration'} onPress={toggle} />
  </View>;
}
const styles=StyleSheet.create({
  wrap:{marginBottom:20,gap:8},frame:{borderWidth:1,borderTopLeftRadius:18,borderTopRightRadius:18,borderBottomLeftRadius:5,borderBottomRightRadius:5,overflow:'hidden'},
  copy:{padding:18,alignItems:'stretch'},title:{fontFamily:'serif',fontSize:27,textAlign:'center'},subtitle:{fontFamily:'serif',fontSize:16,textAlign:'center',marginTop:6,marginBottom:18,lineHeight:24},
  invitation:{borderWidth:1,borderRadius:4,padding:14,minHeight:50,alignItems:'center'},invitationText:{fontFamily:'serif',fontSize:20,textAlign:'center'},
  guideLink:{borderWidth:1,borderRadius:4,padding:12,minHeight:48,alignItems:'center',justifyContent:'center',marginTop:10},guideText:{fontSize:16,textAlign:'center'},
});

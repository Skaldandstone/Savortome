import { Tabs, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, Text, View } from 'react-native';
import { usePalette } from "@/ui";
import { KitchenIcon } from '@/modules/woodland/KitchenIcon';
import { woodlandEnabled } from '@/modules/woodland/Artwork';

/**
 * The six things you do with the app. Labels rather than icons: no icon
 * package is installed, and a wrong-looking icon reads worse than a clear word.
 */
export default function TabsLayout() {
  const c = usePalette();

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: c.surface }}>
    <Tabs
      tabBar={woodlandEnabled ? ({state,descriptors,navigation}) => <View style={{flexDirection:'row',flexWrap:'wrap',backgroundColor:c.surface,borderTopWidth:1,borderColor:c.border,padding:4}}>
        {state.routes.map((route,index) => {
          const selected = state.index === index;
          const title = descriptors[route.key]?.options.title ?? route.name;
          return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={title} accessibilityState={{selected}}
            onPress={() => {const event=navigation.emit({type:'tabPress',target:route.key,canPreventDefault:true});if(!selected && !event.defaultPrevented) navigation.navigate(route.name,route.params);}}
            onLongPress={() => navigation.emit({type:'tabLongPress',target:route.key})}
            style={{flex:1,minWidth:0,minHeight:64,paddingVertical:9,paddingHorizontal:2,alignItems:'center',justifyContent:'center',gap:5,backgroundColor:selected?c.accentSoft:'transparent',borderRadius:4}}>
            <KitchenIcon name={route.name} color={selected?c.accent:c.textMuted} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{fontSize:12,color:selected?c.accent:c.textMuted,textAlign:'center',textDecorationLine:selected?'underline':'none'}}>{title}</Text>
          </Pressable>;
        })}
        <Link href="/legal" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="About Savortome and legal" style={{width:56,minHeight:64,paddingVertical:9,paddingHorizontal:2,alignItems:'center',justifyContent:'center',gap:5,borderRadius:4}}>
            <Text accessible={false} style={{fontSize:22,lineHeight:24,color:c.textMuted}}>ⓘ</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{fontSize:12,color:c.textMuted,textAlign:'center'}}>About</Text>
          </Pressable>
        </Link>
      </View> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Library" }} />
      <Tabs.Screen name="plan" options={{ title: "Plan" }} />
      <Tabs.Screen name="cook" options={{ title: "Cook" }} />
      <Tabs.Screen name="list" options={{ title: "List" }} />
      <Tabs.Screen name="friends" options={{ title: "Friends" }} />
      <Tabs.Screen name="discover" options={{ title: "Discover" }} />
    </Tabs>
    </SafeAreaView>
  );
}

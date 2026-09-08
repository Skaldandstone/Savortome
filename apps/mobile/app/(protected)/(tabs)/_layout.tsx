import { Tabs, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { usePalette } from "@/ui";
import { KitchenIcon } from '@/modules/woodland/KitchenIcon';
import { woodlandEnabled } from '@/modules/woodland/Artwork';

/**
 * The six things you do with the app. Labels rather than icons: no icon
 * package is installed, and a wrong-looking icon reads worse than a clear word.
 */
export default function TabsLayout() {
  const c = usePalette();
  const {fontScale,width} = useWindowDimensions();

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
            style={{width:fontScale > 1.3 || width < 350 ? '33.333%' : '16.666%',minHeight:64,paddingVertical:9,paddingHorizontal:2,alignItems:'center',justifyContent:'center',gap:5,backgroundColor:selected?c.accentSoft:'transparent',borderRadius:4}}>
            <KitchenIcon name={route.name} color={selected?c.accent:c.textMuted} />
            <Text style={{fontSize:12,color:selected?c.accent:c.textMuted,textAlign:'center',textDecorationLine:selected?'underline':'none'}}>{title}</Text>
          </Pressable>;
        })}
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
    <Link href="/legal" style={{ color: c.text, textAlign: "center", padding: 12, minHeight: 44, fontSize: 14 }}>About Savortome and legal</Link>
    </SafeAreaView>
  );
}

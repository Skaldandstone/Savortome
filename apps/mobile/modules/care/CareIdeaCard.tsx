import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { CareFood } from '@seconds/core/format';
import { Button, usePalette } from '@/ui';
import { FoodIllustration, TimberWash } from '@/modules/woodland/Artwork';

export function CareIdeaCard({ label, food, pantryMatches, usePantry, selected, busy, onAdd }: {
  label: string; food: CareFood; pantryMatches: number; usePantry: boolean;
  selected: boolean; busy: boolean; onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const c = usePalette(); const { fontScale } = useWindowDimensions();
  return <View style={[styles.card,{backgroundColor:c.surface,borderColor:selected ? c.accent : c.border}]}>
    <TimberWash />
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} accessibilityLabel={`${label}: ${food.title}. ${food.minutes} minutes. ${open ? 'Hide' : 'Show'} ingredients and steps.`}
      onPress={() => setOpen(!open)} style={styles.summary}>
      {fontScale < 1.6 && <FoodIllustration foodId={food.id} size={112} />}
      <View style={styles.copy}>
        <Text style={[styles.label,{color:c.accent}]}>{label}</Text>
        <Text accessibilityRole="header" style={[styles.title,{color:c.text}]}>{food.title}</Text>
        <Text style={[styles.meta,{color:c.textMuted}]}>{food.minutes} min · {open ? 'Hide details' : 'View details'}</Text>
      </View>
    </Pressable>
    <Text style={[styles.description,{color:c.textMuted}]}>{food.description}</Text>
    {open && <View style={[styles.details,{borderTopColor:c.border}]}>
      <Text style={[styles.body,{color:c.text}]}>Ingredients: {food.ingredients.join(', ')}.</Text>
      {usePantry && pantryMatches > 0 && <Text style={[styles.body,{color:c.textMuted}]}>{pantryMatches} ingredients matched. Other ingredients may still be needed.</Text>}
      {food.steps.map((step,index) => <Text key={`${food.id}-${index}`} style={[styles.body,{color:c.text}]}>{index + 1}. {step}</Text>)}
      <Button label={busy && selected ? `Adding ${food.shoppingItem}...` : `Add ${food.shoppingItem} to my list`} disabled={busy} onPress={onAdd} />
    </View>}
  </View>;
}
const styles=StyleSheet.create({
  card:{borderWidth:1,borderRadius:5,overflow:'hidden',marginVertical:8},summary:{flexDirection:'row',alignItems:'center',minHeight:100},copy:{flex:1,padding:16,gap:6},
  label:{fontFamily:'serif',fontSize:21},title:{fontSize:16,lineHeight:24},meta:{fontSize:13,lineHeight:20},description:{fontSize:15,lineHeight:23,paddingHorizontal:16,paddingBottom:14},
  details:{borderTopWidth:1,padding:16},body:{fontSize:15,lineHeight:23,marginBottom:12},
});

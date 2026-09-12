import { StyleSheet, View } from 'react-native';

/** Small native line icons. Navigation always keeps its readable text label. */
export function KitchenIcon({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
  const stroke = { borderColor:color };
  const line = { backgroundColor:color };
  let content;
  if (name === 'index') content = <><View style={[s.book,stroke]} /><View style={[s.spine,line]} /></>;
  else if (name === 'cook') content = <><View style={[s.pot,stroke]} /><View style={[s.lid,line]} /><View style={[s.handle,stroke]} /></>;
  else if (name === 'plan') content = <><View style={[s.calendar,stroke]} /><View style={[s.calendarLine,line]} /><View style={[s.date,line]} /></>;
  else if (name === 'list') content = <><View style={[s.bag,stroke]} /><View style={[s.bagHandle,stroke]} /></>;
  else if (name === 'friends') content = <><View style={[s.head,stroke]} /><View style={[s.person,stroke]} /></>;
  else content = <><View style={[s.compass,stroke]} /><View style={[s.needle,line]} /></>;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{width:24,height:24,transform:[{scale:size / 24}]}}>{content}</View>;
}
const s=StyleSheet.create({
  book:{position:'absolute',left:2,top:4,width:20,height:17,borderWidth:1.4,borderRadius:2},spine:{position:'absolute',left:11.5,top:4,width:1.4,height:17},
  pot:{position:'absolute',left:4,top:8,width:16,height:13,borderWidth:1.4,borderBottomLeftRadius:6,borderBottomRightRadius:6},lid:{position:'absolute',left:2,top:6,width:20,height:1.4},handle:{position:'absolute',left:10,top:2,width:5,height:4,borderWidth:1.4,borderRadius:2},
  calendar:{position:'absolute',left:3,top:4,width:18,height:18,borderWidth:1.4,borderRadius:2},calendarLine:{position:'absolute',left:3,top:9,width:18,height:1.4},date:{position:'absolute',left:7,top:13,width:4,height:4},
  bag:{position:'absolute',left:4,top:8,width:16,height:14,borderWidth:1.4,borderRadius:2},bagHandle:{position:'absolute',left:8,top:2,width:8,height:10,borderWidth:1.4,borderRadius:5},
  head:{position:'absolute',left:8,top:2,width:8,height:8,borderWidth:1.4,borderRadius:4},person:{position:'absolute',left:4,top:12,width:16,height:10,borderWidth:1.4,borderTopLeftRadius:8,borderTopRightRadius:8},
  compass:{position:'absolute',left:2,top:2,width:20,height:20,borderWidth:1.4,borderRadius:10},needle:{position:'absolute',left:11,top:5,width:2,height:14,transform:[{rotate:'35deg'}]},
});

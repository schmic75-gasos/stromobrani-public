import { createWidget } from 'expo-widgets';
import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

const TreeWidget = (props) => {
  'widget';
  return (
    <VStack>
      <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle('#1f3d2b')]}>Stromobraní 🌳</Text>
      <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#4f7a3a')]}>{props.streak} dní v sérii</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle('#23301f')]}>{props.treeName || 'Žádný strom poblíž'}</Text>
      <Text modifiers={[font({ size: 11 }), foregroundStyle('#7a8570')]}>{props.distance || ''}</Text>
    </VStack>
  );
};

export default createWidget('TreeWidget', TreeWidget);

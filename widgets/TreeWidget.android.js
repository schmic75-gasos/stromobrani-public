import { requireNativeModule } from 'expo-modules-core';

const NativeTreeWidget = requireNativeModule('StromobraniWidget');

export default {
  updateSnapshot(props) {
    NativeTreeWidget.updateSnapshot(props);
  },
};

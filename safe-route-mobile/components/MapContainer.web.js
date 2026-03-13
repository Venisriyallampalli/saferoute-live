import React from 'react';
import { View, Text } from 'react-native';

const MapView = ({ children, style }) => (
  <View style={[{ backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }, style]}>
    <Text className="text-slate-500 font-bold">Map View Not Supported on Web</Text>
    <Text className="text-slate-400 text-xs">Please use Expo Go on a mobile device</Text>
    {children}
  </View>
);

export const Marker = ({ children }) => <View>{children}</View>;
export const PROVIDER_GOOGLE = 'google';

export default MapView;

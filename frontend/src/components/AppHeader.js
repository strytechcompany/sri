import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADER_BG = '#3D2200';
const GOLD = '#D4AF37';
const WHITE = '#FFFFFF';

export default function AppHeader({ title = 'Sri Vaishnavi Jewellers', onMenuPress, onLogoutPress }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44) }]}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} />
      <TouchableOpacity style={styles.iconBtn} onPress={onMenuPress} activeOpacity={0.7}>
        <MaterialCommunityIcons name="menu" size={26} color={GOLD} />
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <TouchableOpacity style={styles.iconBtn} onPress={onLogoutPress} activeOpacity={0.7}>
        <MaterialCommunityIcons name="logout" size={24} color={GOLD} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: HEADER_BG,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 100,
  },
  title: {
    color: GOLD,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
});

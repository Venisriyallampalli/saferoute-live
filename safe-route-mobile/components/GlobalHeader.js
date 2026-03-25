import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Pressable } from 'react-native';
import { Shield, Palette, Moon, Sun, Menu, X, User, Settings, LogOut, Home } from 'lucide-react-native';
import { useTheme, ThemePresets } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function GlobalHeader({ navigation }) {
  const { theme, themeName, setThemeName, isDarkMode, setIsDarkMode, colors } = useTheme();
  const { logout, user } = useAuth();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const navigateSafe = (routeName) => {
    if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate(routeName);
    }
  };

  const menuItems = [
    { label: 'Home', icon: Home, action: () => navigateSafe('Home') },
    { label: 'Profile', icon: User, action: () => navigateSafe('Profile') },
    { label: 'Settings', icon: Settings, action: () => navigateSafe('Settings') },
    { label: 'Sign Out', icon: LogOut, action: () => logout(), color: '#ef4444' },
  ];

  return (
    <View 
      style={{ backgroundColor: colors.background, borderBottomColor: colors.border }} 
      className="flex-row items-center justify-between px-4 py-4 border-b z-[50]"
    >
      {/* App Logo */}
      <TouchableOpacity 
        className="flex-row items-center" 
        onPress={() => navigateSafe('Home')}
      >
        <Shield size={22} color={theme.primary} fill={theme.primary} />
        <Text 
          style={{ color: colors.text }} 
          className="ml-2 text-lg font-black tracking-tight"
        >
          SafeRoute <Text style={{ color: theme.primary }}>Live</Text>
        </Text>
      </TouchableOpacity>

      {/* Action Icons */}
      <View className="flex-row items-center gap-x-4">
        {/* Theme Palette Switcher */}
        <TouchableOpacity onPress={() => setShowThemePicker(true)}>
          <Palette size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Dark Mode Toggle */}
        <TouchableOpacity onPress={() => setIsDarkMode(!isDarkMode)}>
          {isDarkMode ? (
            <Sun size={20} color="#f59e0b" />
          ) : (
            <Moon size={20} color={colors.textMuted} />
          )}
        </TouchableOpacity>

        {/* Menu (Placeholder or Draw Toggle) */}
        <TouchableOpacity onPress={() => setShowMenu(true)}>
          <Menu size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Theme Picker Modal */}
      <Modal
        visible={showThemePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowThemePicker(false)}
      >
        <Pressable 
          className="flex-1 bg-black/40 items-center justify-center p-6"
          onPress={() => setShowThemePicker(false)}
        >
          <View 
            style={{ backgroundColor: colors.surface }} 
            className="w-full max-w-sm rounded-[32px] p-6 shadow-2xl"
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text style={{ color: colors.text }} className="text-xl font-black">Theme Presets</Text>
              <TouchableOpacity onPress={() => setShowThemePicker(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {Object.keys(ThemePresets).map((name) => (
              <TouchableOpacity
                key={name}
                className="flex-row items-center py-4 border-b border-slate-50/10 mb-2 last:border-0"
                onPress={() => {
                  setThemeName(name);
                  setShowThemePicker(false);
                }}
              >
                <View 
                  style={{ backgroundColor: ThemePresets[name].primary }} 
                  className="w-10 h-10 rounded-full shadow-lg items-center justify-center"
                >
                  {themeName === name && <Text className="text-white font-black text-xs">✓</Text>}
                </View>
                <View className="ml-4">
                   <Text 
                     style={{ color: themeName === name ? theme.primary : colors.text }} 
                     className="text-lg font-bold"
                   >
                     {name}
                   </Text>
                   <Text style={{ color: colors.textMuted }} className="text-[10px] font-bold uppercase tracking-widest">
                      {name === 'Ocean' ? 'Default Blue' : 'Safety Accent'}
                   </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Main App Menu Modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable 
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowMenu(false)}
        >
          <View 
            style={{ backgroundColor: colors.surface }} 
            className="w-full rounded-t-[40px] p-8 shadow-2xl pb-12"
          >
            <View className="flex-row items-center justify-between mb-8">
              <View>
                <Text style={{ color: colors.text }} className="text-2xl font-black">Account</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs font-bold uppercase tracking-widest mt-1">
                  {user?.name || 'SafeRoute Guest'}
                </Text>
              </View>
              <TouchableOpacity 
                className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center" 
                onPress={() => setShowMenu(false)}
              >
                <X size={20} color="#1e293b" />
              </TouchableOpacity>
            </View>

            <View className="gap-y-2">
              {menuItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <TouchableOpacity 
                    key={idx}
                    activeOpacity={0.7}
                    style={{ backgroundColor: colors.background }}
                    className="flex-row items-center p-5 rounded-[24px] mb-2 border border-slate-50/5"
                    onPress={() => {
                       setShowMenu(false);
                       item.action();
                    }}
                  >
                    <View className={`w-10 h-10 rounded-xl items-center justify-center ${item.color ? 'bg-red-50' : 'bg-blue-50'}`}>
                      <Icon size={20} color={item.color || theme.primary} />
                    </View>
                    <Text 
                      style={{ color: item.color || colors.text }} 
                      className="ml-4 text-base font-bold"
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="mt-8 items-center border-t border-slate-100 pt-6">
               <Text style={{ color: colors.textMuted }} className="text-[10px] font-black uppercase tracking-[5px]">
                  SafeRoute Live v1.0
               </Text>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

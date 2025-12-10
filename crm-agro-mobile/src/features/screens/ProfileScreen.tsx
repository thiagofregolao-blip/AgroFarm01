import React from "react";
import { View, Text, Button, Alert } from "react-native";
import { useAuth } from "@auth/AuthContext";
import * as Location from "expo-location";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  async function checkPerms() {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    Alert.alert(
      "Permissões",
      `Foreground: ${fg.status}\nBackground: ${bg.status}`
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Text style={{ fontWeight: "bold", fontSize: 16 }}>Perfil</Text>
      <Text>Usuário: {user?.username}</Text>
      <Text>Papel: {user?.role}</Text>

      <Button title="Ver permissões de GPS" onPress={checkPerms} />
      <Button title="Sair" color="#c0392b" onPress={logout} />
    </View>
  );
}

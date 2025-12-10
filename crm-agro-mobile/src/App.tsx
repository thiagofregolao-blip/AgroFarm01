import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { initDb } from "@db/schema";
import { registerBaseGeofence } from "@geo/tripDetector";
import { AuthProvider, useAuth } from "@auth/AuthContext";
import { queryClient } from "@lib/queryClient";
import LoginScreen from "@auth/LoginScreen";
import AppNavigator from "@features/navigation/AppNavigator";

function Main() {
  const { user, loading } = useAuth();

  useEffect(() => {
    initDb();
    if (user) {
      registerBaseGeofence(-25.3000, -57.6000, 200).catch(err => {
        console.log('Geofence registration skipped:', err.message);
      });
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <AppNavigator />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Main />
      </AuthProvider>
    </QueryClientProvider>
  );
}

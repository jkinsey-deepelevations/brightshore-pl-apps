import { JSX } from "react";
import HomeScreen from "./views/HomeScreen";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App(): JSX.Element {
  return (
    <SafeAreaProvider>
      <HomeScreen />
    </SafeAreaProvider>
  );
}

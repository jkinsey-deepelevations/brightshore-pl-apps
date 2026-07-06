import { JSX } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import brand from "../brand";
import { moderateScale } from "react-native-size-matters";

type NavbarProps = {
  onNavigate: (uri: string) => void;
};

export default function BottomBar({ onNavigate }: NavbarProps): JSX.Element {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onNavigate(`${brand.baseUrl}`)}
      >
        <Ionicons style={styles.icons} name="home-outline" size={22} />
        <Text style={styles.label}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onNavigate(`${brand.baseUrl}/manage#QuickAction`)}
      >
        <Ionicons style={styles.icons} name="cash-outline" size={22} />
        <Text style={styles.label}>Payment</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onNavigate(`${brand.eStatusHomeUrl}`)}
      >
        <Ionicons style={styles.icons} name="person-outline" size={22} />
        <Text style={styles.label}>Login</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onNavigate(`${brand.faqUrl}`)}
      >
        <Ionicons style={styles.icons} name="help-circle-outline" size={22} />
        <Text style={styles.label}>FAQ</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: brand.primary,
    paddingVertical: 8,
  },
  navItem: {
    alignItems: "center",
    flex: 1,
  },
  label: {
    fontSize: moderateScale(12),
    marginTop: 3,
    color: brand.textColor,
    width: "100%",
    textAlign: "center",
  },
  icons: { color: brand.iconColor },
});

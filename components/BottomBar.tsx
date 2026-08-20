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
        accessibilityLabel="Home tab"
        style={styles.navItem}
        testID="nav-home"
        onPress={() => onNavigate(brand.initialUrl)}
      >
        <Ionicons style={styles.icons} name="home-outline" size={22} />
        <Text style={styles.label}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="Payment tab"
        style={styles.navItem}
        testID="nav-payment"
        onPress={() => onNavigate(brand.paymentUrl)}
      >
        <Ionicons style={styles.icons} name="cash-outline" size={22} />
        <Text style={styles.label}>Payment</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="Login tab"
        style={styles.navItem}
        testID="nav-login"
        onPress={() => onNavigate(brand.loginUrl)}
      >
        <Ionicons style={styles.icons} name="person-outline" size={22} />
        <Text style={styles.label}>Login</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="FAQ tab"
        style={styles.navItem}
        testID="nav-faq"
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

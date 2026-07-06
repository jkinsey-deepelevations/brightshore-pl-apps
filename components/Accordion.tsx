import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import brand from "../brand";
import { moderateScale } from "react-native-size-matters";

type AccordionProps = {
  onNavigate: (uri: string) => void;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const NAVBAR_HEIGHT = 60;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

export default function ContactAccordion({ onNavigate }: AccordionProps) {
  const [open, setOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const toggleDrawer = () => {
    if (!open) {
      setDrawerVisible(true);
    }

    setOpen(!open);
  };

  useEffect(() => {
    if (open) {
      setDrawerVisible(true);
    }

    Animated.timing(slideAnim, {
      toValue: open ? 0 : -DRAWER_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) {
        setDrawerVisible(false);
      }
    });
  }, [open]);

  const handleNavigate = (uri: string) => {
    onNavigate(uri);
    setOpen(false);
  };

  const handleExternal = (url: string) => {
    Linking.openURL(url);
    setOpen(false);
  };

  return (
    <View style={{ zIndex: 50 }}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={toggleDrawer}>
          <Text style={styles.iconButton}>☰</Text>
        </TouchableOpacity>
      </View>

      {drawerVisible ? (
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}
        >
          <View style={styles.drawerContent}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigate(`${brand.baseUrl}`)}
            >
              <Ionicons name="home-outline" size={20} />
              <Text style={styles.text}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                handleNavigate(`${brand.baseUrl}/${brand.aboutSlug}`)
              }
            >
              <Ionicons name="information-circle-outline" size={20} />
              <Text style={styles.text}>About</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                handleNavigate(`${brand.baseUrl}/mortgage-assistance`)
              }
            >
              <Ionicons name="heart-outline" size={20} />
              <Text style={styles.text}>Hardship</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleExternal(`tel:${brand.phone}`)}
            >
              <Ionicons name="call-outline" size={20} />
              <Text style={styles.text}>Call Us</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleExternal(`mailto:${brand.email}`)}
            >
              <Ionicons name="mail-outline" size={20} />
              <Text style={styles.text}>Email Us</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigate(`${brand.chatUrl}`)}
            >
              <Ionicons name="chatbubbles-outline" size={20} />
              <Text style={styles.text}>Contact</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                handleNavigate(`${brand.baseUrl}/refinancing-your-loan`)
              }
            >
              <Ionicons name="repeat" size={20} />
              <Text style={styles.text}>Refinance</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    height: NAVBAR_HEIGHT,
    backgroundColor: brand.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    elevation: 3,
    zIndex: 10,
  },
  iconButton: {
    fontSize: moderateScale(26),
    marginRight: 12,
    color: brand.textColor,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  drawer: {
    position: "absolute",
    top: NAVBAR_HEIGHT,
    left: 0,
    width: DRAWER_WIDTH,
    height: SCREEN_HEIGHT - NAVBAR_HEIGHT,
    backgroundColor: brand.textColor,
    elevation: 5,
    borderRightWidth: 1,
    borderRightColor: brand.borderColor,
    zIndex: 20,
  },
  drawerContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  text: {
    marginLeft: 10,
    fontSize: moderateScale(16),
    flex: 1,
  },
});

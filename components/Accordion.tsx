import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  Alert,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  type GestureResponderEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import brand from "../brand";
import brandAssets from "../brandAssets";
import { moderateScale } from "react-native-size-matters";

type AccordionProps = {
  onNavigate: (uri: string) => void;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const NAVBAR_HEIGHT = 60;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.84, 420);
const MENU_ITEMS = [
  {
    icon: "home-outline",
    label: brand.drawerLabels?.home || "Home",
    onPress: "home",
  },
  {
    icon: "information-circle-outline",
    label: brand.drawerLabels?.about || "About",
    onPress: "about",
  },
  {
    icon: "heart-outline",
    label: brand.drawerLabels?.hardship || "Hardship",
    onPress: "hardship",
  },
  {
    icon: "call-outline",
    label: "Call Us",
    onPress: "call",
  },
  {
    icon: "mail-outline",
    label: "Email Us",
    onPress: "email",
  },
  {
    icon: "chatbubbles-outline",
    label: brand.drawerLabels?.contact || "Contact",
    onPress: "contact",
  },
  {
    icon: "repeat",
    label: brand.drawerLabels?.refinance || "Refinance",
    onPress: "refinance",
  },
] as const;

export default function ContactAccordion({ onNavigate }: AccordionProps) {
  const [open, setOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const touchStart = useRef({ x: 0, y: 0 }).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        gestureState.dx < -8 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dx < -8 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => {
        slideAnim.setValue(Math.max(-DRAWER_WIDTH, Math.min(0, gestureState.dx)));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -DRAWER_WIDTH * 0.25 || gestureState.vx < -0.5) {
          setOpen(false);
          return;
        }

        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const toggleDrawer = () => {
    if (!open) {
      slideAnim.setValue(0);
      setDrawerVisible(true);
      setOpen(true);
      return;
    }

    setOpen(false);
  };

  const closeDrawer = () => {
    setOpen(false);
  };

  const handleDrawerTouchStart = (event: GestureResponderEvent) => {
    touchStart.x = event.nativeEvent.pageX;
    touchStart.y = event.nativeEvent.pageY;
  };

  const handleDrawerTouchEnd = (event: GestureResponderEvent) => {
    const dx = event.nativeEvent.pageX - touchStart.x;
    const dy = event.nativeEvent.pageY - touchStart.y;

    if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      closeDrawer();
    }
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

  const handleExternal = async (url: string, fallbackMessage: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);

      if (!canOpen) {
        Alert.alert("Unable to open", fallbackMessage);
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open", fallbackMessage);
    }

    setOpen(false);
  };

  const handleMenuItem = (item: (typeof MENU_ITEMS)[number]) => {
    switch (item.onPress) {
      case "home":
        handleNavigate(brand.initialUrl);
        break;
      case "about":
        handleNavigate(brand.aboutUrl);
        break;
      case "hardship":
        handleNavigate(brand.hardshipUrl);
        break;
      case "call":
        handleExternal(
          `tel:${brand.phone}`,
          `Please call ${brand.appName} at ${brand.phone}.`
        );
        break;
      case "email":
        handleExternal(
          `mailto:${brand.email}`,
          `Please email ${brand.appName} at ${brand.email}.`
        );
        break;
      case "contact":
        handleNavigate(brand.chatUrl);
        break;
      case "refinance":
        handleNavigate(brand.refinanceUrl);
        break;
    }
  };

  return (
    <View style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity
          accessibilityLabel={open ? "Close menu" : "Open menu"}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          onPress={toggleDrawer}
          style={styles.menuButton}
          testID="nav-menu"
        >
          <Ionicons
            color={brand.iconColor}
            name="menu"
            size={30}
          />
        </TouchableOpacity>
      </View>

      <Modal
        animationType="none"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={drawerVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close menu"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <Animated.View
            {...panResponder.panHandlers}
            onMoveShouldSetResponderCapture={(event) => {
              const dx = event.nativeEvent.pageX - touchStart.x;
              const dy = event.nativeEvent.pageY - touchStart.y;

              return dx < -8 && Math.abs(dx) > Math.abs(dy);
            }}
            onResponderRelease={handleDrawerTouchEnd}
            onResponderTerminationRequest={() => false}
            onTouchEnd={handleDrawerTouchEnd}
            onTouchStart={handleDrawerTouchStart}
            pointerEvents={open ? "auto" : "none"}
            style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}
        >
            <View style={styles.drawerHeader}>
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                source={brandAssets.drawerLogo}
                style={styles.drawerLogo}
              />
            </View>
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.drawerContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.drawerScroller}
            >
              <Text style={styles.drawerEyebrow}>Navigation</Text>
              <View style={styles.goldRule} />

              {MENU_ITEMS.map((item) => (
                <TouchableOpacity
                  activeOpacity={0.76}
                  accessibilityLabel={`${item.label} menu item`}
                  key={item.label}
                  onPress={() => handleMenuItem(item)}
                  style={styles.menuItem}
                  testID={`drawer-${item.onPress}`}
                >
                  <View style={styles.iconPill}>
                    <Ionicons color={brand.secondary} name={item.icon} size={20} />
                  </View>
                  <Text style={styles.text}>{item.label}</Text>
                  <Ionicons
                    color="#9aa0a9"
                    name="chevron-forward"
                    size={18}
                  />
                </TouchableOpacity>
              ))}

              <View style={styles.supportCard}>
                <View style={styles.supportIcon}>
                  <Ionicons color="#fff" name="headset-outline" size={16} />
                </View>
                <View style={styles.supportCopy}>
                  <Text style={styles.supportTitle}>Need help?</Text>
                  <Text style={styles.supportText}>Call, email, or message support.</Text>
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
    zIndex: 50,
    elevation: Platform.OS === "android" ? 50 : 0,
  },
  navbar: {
    height: NAVBAR_HEIGHT,
    backgroundColor: brand.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    elevation: 3,
    zIndex: 10,
  },
  menuButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    marginRight: 12,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  modalRoot: {
    flex: 1,
  },
  drawer: {
    position: "absolute",
    top: NAVBAR_HEIGHT,
    left: 0,
    width: DRAWER_WIDTH,
    bottom: 0,
    backgroundColor: "#f8f9fb",
    elevation: 12,
    borderRightWidth: 1,
    borderRightColor: "#d9dde6",
    zIndex: 20,
    shadowColor: "#101828",
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  backdrop: {
    backgroundColor: "rgba(10, 16, 34, 0.22)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 15,
  },
  drawerHeader: {
    alignItems: "center",
    backgroundColor: brand.primary,
    flexDirection: "row",
    justifyContent: "flex-start",
    minHeight: 82,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  drawerLogo: {
    height: 40,
    width: 168,
  },
  drawerScroller: {
    flex: 1,
  },
  drawerContent: {
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  drawerEyebrow: {
    color: brand.secondary,
    fontSize: moderateScale(11),
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  goldRule: {
    backgroundColor: brand.secondary,
    borderRadius: 2,
    height: 3,
    marginBottom: 10,
    marginTop: 7,
    width: 54,
  },
  menuItem: {
    backgroundColor: "#fff",
    borderColor: "#e4e7ee",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    minHeight: 52,
    paddingHorizontal: 12,
    shadowColor: "#20275a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
  },
  iconPill: {
    alignItems: "center",
    backgroundColor: "#f5edd8",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    marginRight: 11,
    width: 32,
  },
  text: {
    color: brand.primary,
    flex: 1,
    fontSize: moderateScale(15),
    fontWeight: "700",
  },
  supportCard: {
    alignItems: "center",
    backgroundColor: brand.primary,
    borderLeftColor: brand.secondary,
    borderLeftWidth: 3,
    borderRadius: 8,
    flexDirection: "row",
    marginTop: 2,
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  supportIcon: {
    alignItems: "center",
    backgroundColor: brand.secondary,
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    marginRight: 10,
    width: 28,
  },
  supportCopy: {
    flex: 1,
  },
  supportTitle: {
    color: "#fff",
    fontSize: moderateScale(12),
    fontWeight: "800",
  },
  supportText: {
    color: "#e9edf6",
    fontSize: moderateScale(10),
    lineHeight: moderateScale(14),
    marginTop: 1,
  },
});

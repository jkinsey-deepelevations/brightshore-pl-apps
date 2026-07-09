import Expo
import React
import ReactAppDependencyProvider

#if canImport(AppTrackingTransparency)
import AppTrackingTransparency
#endif

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  private var hasScheduledTrackingAuthorizationRequest = false

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  public override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
    requestTrackingAuthorizationIfNeeded()
  }

  private func requestTrackingAuthorizationIfNeeded() {
#if os(iOS) && canImport(AppTrackingTransparency)
    guard #available(iOS 14, *) else {
      return
    }

    guard !hasScheduledTrackingAuthorizationRequest else {
      return
    }

    guard Bundle.main.object(forInfoDictionaryKey: "NSUserTrackingUsageDescription") != nil else {
      assertionFailure("Missing NSUserTrackingUsageDescription; ATT prompt cannot be shown.")
      return
    }

    guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else {
      return
    }

    hasScheduledTrackingAuthorizationRequest = true

    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
      guard let self = self else {
        return
      }

      guard UIApplication.shared.applicationState == .active else {
        self.hasScheduledTrackingAuthorizationRequest = false
        return
      }

      guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else {
        return
      }

      ATTrackingManager.requestTrackingAuthorization { status in
        DispatchQueue.main.async {
          if status == .notDetermined {
            self.hasScheduledTrackingAuthorizationRequest = false
          }
        }
      }
    }
#endif
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

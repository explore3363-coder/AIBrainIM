import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "AIBrainIM",
      in: window,
      launchOptions: launchOptions
    )

    window?.makeKeyAndVisible()
    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    return self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // In debug, always try Metro first
    let metroURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    if metroURL != nil {
      return metroURL
    }
#endif
    // Try main.jsbundle first (standard location)
    if let bundleURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
      return bundleURL
    }
    // Fallback: try main.hbc (Hermes bytecode)
    if let hbcURL = Bundle.main.url(forResource: "main", withExtension: "hbc") {
      return hbcURL
    }
    // Last resort: try jsbundle in a different path
    if let altURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle", subdirectory: "Assets") {
      return altURL
    }
    // Return a dummy URL to prevent crash - app will show error gracefully
    print("[AIBrainIM] WARNING: No JS bundle found! Using empty bundle path.")
    return nil
  }
}

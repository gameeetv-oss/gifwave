import UIKit
import Capacitor

// iOS 27 SDK ile derlenen uygulamalarda UIScene yaşam döngüsü zorunlu (Apple TN3187).
// Pencere ve kök ekran Main.storyboard'dan gelir (özel ViewController korunur).
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard scene is UIWindowScene else { return }
        // Cordova eklentileri (OneSignal) ve Capacitor, pencereye AppDelegate üzerinden de ulaşabilsin
        (UIApplication.shared.delegate as? AppDelegate)?.window = window
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

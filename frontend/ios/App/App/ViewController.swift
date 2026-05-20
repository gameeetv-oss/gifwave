import UIKit
import Capacitor
import WebKit

class ViewController: CAPBridgeViewController {
    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.allowsInlineMediaPlayback = true
        return super.webView(with: frame, configuration: configuration)
    }
}

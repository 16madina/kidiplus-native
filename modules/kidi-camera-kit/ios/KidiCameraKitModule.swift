import ExpoModulesCore

/// Expo Modules bridge for the Snap Camera Kit + LiveKit native session
/// (`KidiCameraKitSession`). Method names/args mirror the previous Capacitor
/// plugin (and the Android `KidiCameraKitModule`) so the JS bridge
/// (`src/lib/filters/camera-kit-bridge.ts`) does not need to change shape.
public class KidiCameraKitModule: Module {
    private let session = KidiCameraKitSession.shared

    public func definition() -> ModuleDefinition {
        Name("KidiCameraKit")

        Events("status", "captureState", "pluginLoaded")

        OnCreate {
            self.session.onEvent = { [weak self] name, data in
                self?.sendEvent(name, data)
            }
        }

        OnDestroy {
            self.session.onEvent = nil
        }

        AsyncFunction("initialize") { (apiToken: String, groupIds: [String], promise: Promise) in
            self.session.initialize(apiToken: apiToken, groupIds: groupIds) { result in
                switch result {
                case .success:
                    promise.resolve(["initialized": true])
                case .failure(let error):
                    promise.reject(error)
                }
            }
        }

        AsyncFunction("loadLenses") { (groupIds: [String], promise: Promise) in
            self.session.loadLenses(groupIds: groupIds) { result in
                switch result {
                case .success(let lenses):
                    promise.resolve(["lenses": lenses.map { $0.toDictionary() }])
                case .failure(let error):
                    promise.reject(error)
                }
            }
        }

        AsyncFunction("applyLens") { (lensId: String, groupId: String, promise: Promise) in
            self.session.applyLens(lensId: lensId, groupId: groupId) { result in
                switch result {
                case .success:
                    promise.resolve(["applied": true])
                case .failure(let error):
                    promise.reject(error)
                }
            }
        }

        AsyncFunction("clearLens") { (promise: Promise) in
            self.session.clearLens { cleared in
                promise.resolve(["cleared": cleared])
            }
        }

        AsyncFunction("startPreview") { (mirrored: Bool, facing: String, promise: Promise) in
            self.session.startPreview(mirrored: mirrored, facing: facing) { started in
                promise.resolve(["started": started])
            }
        }

        AsyncFunction("stopPreview") { (promise: Promise) in
            self.session.stopPreview { stopped in
                promise.resolve(["stopped": stopped])
            }
        }

        AsyncFunction("flipCamera") { (promise: Promise) in
            self.session.flipCamera { result in
                switch result {
                case .success(let facing):
                    promise.resolve(["flipped": true, "facing": facing])
                case .failure(let error):
                    promise.reject(error)
                }
            }
        }

        AsyncFunction("setPublishEnabled") { (enabled: Bool, roomUrl: String?, token: String?, promise: Promise) in
            self.session.setPublishEnabled(enabled: enabled, roomUrl: roomUrl, token: token) { result in
                switch result {
                case .success(let isEnabled):
                    promise.resolve(["enabled": isEnabled])
                case .failure(let error):
                    promise.reject(error)
                }
            }
        }

        AsyncFunction("getStatus") { () -> [String: Any] in
            self.session.getStatus()
        }

        AsyncFunction("isAvailable") { () -> [String: Any] in
            self.session.isAvailable()
        }
    }
}

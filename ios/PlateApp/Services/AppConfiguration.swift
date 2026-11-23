import Foundation

enum ConfigurationError: LocalizedError {
    case missingValue(String)
    case invalidURL(String)

    var errorDescription: String? {
        switch self {
        case .missingValue(let key):
            return "Missing \(key). Add it to Config.xcconfig."
        case .invalidURL(let value):
            return "SUPABASE_URL is not a valid URL: \(value)"
        }
    }
}

struct AppConfiguration: Sendable {
    let supabaseURL: URL
    let supabaseAnonKey: String

    static func load(bundle: Bundle = .main) throws -> AppConfiguration {
        guard let rawURL = bundle.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
              !rawURL.isEmpty,
              !rawURL.contains("$(") else {
            throw ConfigurationError.missingValue("SUPABASE_URL")
        }
        guard let url = URL(string: rawURL) else {
            throw ConfigurationError.invalidURL(rawURL)
        }
        guard let key = bundle.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
              !key.isEmpty,
              !key.contains("$(") else {
            throw ConfigurationError.missingValue("SUPABASE_ANON_KEY")
        }

        return AppConfiguration(supabaseURL: url, supabaseAnonKey: key)
    }
}

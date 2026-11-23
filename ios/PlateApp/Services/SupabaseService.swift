import Combine
import Foundation
import Supabase

@MainActor
final class SupabaseService: ObservableObject {
    let client: SupabaseClient?
    @Published private(set) var configurationError: String?

    init(configuration: AppConfiguration? = try? AppConfiguration.load()) {
        if let configuration {
            client = SupabaseClient(
                supabaseURL: configuration.supabaseURL,
                supabaseKey: configuration.supabaseAnonKey
            )
            configurationError = nil
        } else {
            client = nil
            configurationError = "Supabase is not configured. Copy Config.xcconfig.example to Config.xcconfig and add local credentials."
        }
    }

    func signIn(email: String, password: String) async throws {
        guard let client else {
            throw ConfigurationError.missingValue("Supabase configuration")
        }
        try await client.auth.signIn(email: email, password: password)
    }

    func signOut() async throws {
        guard let client else { return }
        try await client.auth.signOut()
    }

    func searchCatalog(_ query: String, limit: Int = 20) async throws -> [CatalogFood] {
        guard let client else {
            throw ConfigurationError.missingValue("Supabase configuration")
        }

        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalizedQuery.count >= 2 else { return [] }

        let foods: [CatalogFood] = try await client
            .rpc(
                "search_branded_foods",
                params: SearchCatalogParams(
                    searchQuery: normalizedQuery,
                    resultLimit: min(max(limit, 1), 50)
                )
            )
            .execute()
            .value

        return foods
    }

    static func catalogSearchErrorMessage(from error: Error) -> String {
        let message = error.localizedDescription.lowercased()
        if message.contains("search_branded_foods") && message.contains("schema cache") {
            return """
            The branded-food catalog is not installed in this Supabase project yet.

            In the Supabase SQL editor, run:
            supabase/migrations/add_branded_food_catalog.sql

            Then reload the API schema (Settings → API → Reload schema) and try again.
            """
        }
        return error.localizedDescription
    }
}

private struct SearchCatalogParams: Encodable, Sendable {
    let searchQuery: String
    let resultLimit: Int

    enum CodingKeys: String, CodingKey {
        case searchQuery = "search_query"
        case resultLimit = "result_limit"
    }
}

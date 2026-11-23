import SwiftUI

struct CatalogSearchView: View {
    @EnvironmentObject private var supabase: SupabaseService
    @State private var query = ""
    @State private var foods: [CatalogFood] = []
    @State private var isSearching = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                if query.count >= 2 && foods.isEmpty && !isSearching && errorMessage == nil {
                    ContentUnavailableView.search(text: query)
                }

                ForEach(foods) { food in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(food.name)
                            .font(.headline)

                        if let brand = food.brand, !brand.isEmpty {
                            Text(brand)
                                .foregroundStyle(.secondary)
                        }

                        Text(servingText(for: food))
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Text(
                            "\(food.calories.formatted(.number.precision(.fractionLength(0)))) cal · " +
                            "\(food.proteinGrams.formatted(.number.precision(.fractionLength(0...1))))g protein · " +
                            "\(food.carbohydrateGrams.formatted(.number.precision(.fractionLength(0...1))))g carbs"
                        )
                        .font(.caption)
                    }
                    .padding(.vertical, 4)
                }
            }
            .overlay {
                if isSearching {
                    ProgressView("Searching Plate catalog…")
                } else if query.count < 2 {
                    ContentUnavailableView(
                        "Search branded foods",
                        systemImage: "magnifyingglass",
                        description: Text("Enter at least two characters.")
                    )
                }
            }
            .navigationTitle("Food catalog")
            .searchable(text: $query, prompt: "Food or brand")
            .task(id: query) {
                await search()
            }
            .alert(
                "Catalog search failed",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { if !$0 { errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    @MainActor
    private func search() async {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalizedQuery.count >= 2 else {
            foods = []
            errorMessage = nil
            return
        }

        do {
            try await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            isSearching = true
            defer { isSearching = false }
            foods = try await supabase.searchCatalog(normalizedQuery)
            errorMessage = nil
        } catch is CancellationError {
            // A newer query replaced this one.
        } catch {
            foods = []
            errorMessage = SupabaseService.catalogSearchErrorMessage(from: error)
        }
    }

    private func servingText(for food: CatalogFood) -> String {
        if let description = food.servingDescription, !description.isEmpty {
            return description
        }
        return "\(food.servingSize.formatted()) \(food.servingUnit)"
    }
}

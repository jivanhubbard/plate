import Foundation

struct CatalogFood: Identifiable, Codable, Hashable, Sendable {
    let id: Int64
    var name: String
    var brand: String?
    var barcode: String?
    var servingSize: Double
    var servingUnit: String
    var servingDescription: String?
    var calories: Double
    var proteinGrams: Double
    var carbohydrateGrams: Double
    var fatGrams: Double
    var fiberGrams: Double
    var imageURL: URL?
    var source: String

    enum CodingKeys: String, CodingKey {
        case id, name, brand, barcode, calories, source
        case servingSize = "serving_size"
        case servingUnit = "serving_unit"
        case servingDescription = "serving_description"
        case proteinGrams = "protein"
        case carbohydrateGrams = "carbs"
        case fatGrams = "fat"
        case fiberGrams = "fiber"
        case imageURL = "image_url"
    }
}

struct FoodLogDraft: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var name: String
    var servingDescription: String
    var calories: Double
    var proteinGrams: Double
    var carbohydrateGrams: Double
    var fatGrams: Double
    var fiberGrams: Double
    var source: Source

    enum Source: String, Codable, Sendable {
        case manual
        case nutritionFactsPhoto
        case photoEstimate
        case catalog
    }

    static let empty = FoodLogDraft(
        id: UUID(),
        name: "",
        servingDescription: "",
        calories: 0,
        proteinGrams: 0,
        carbohydrateGrams: 0,
        fatGrams: 0,
        fiberGrams: 0,
        source: .manual
    )
}

enum WorkoutClassification: String, Codable, CaseIterable, Identifiable, Sendable {
    case strength
    case cardio
    case mobility
    case sport
    case other

    var id: Self { self }
    var title: String { rawValue.capitalized }
}

struct ImportedWorkout: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let healthKitIdentifier: String
    let startedAt: Date
    let durationSeconds: TimeInterval
    let activityName: String
    var classification: WorkoutClassification?
}

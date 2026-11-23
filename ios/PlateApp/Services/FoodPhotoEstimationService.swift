import Foundation

struct FoodPhotoEstimate: Sendable {
    let draft: FoodLogDraft
    let confidence: Float
    let explanation: String
}

protocol FoodPhotoEstimating: Sendable {
    func estimate(imageData: Data) async throws -> FoodPhotoEstimate
}

enum FoodPhotoEstimationError: LocalizedError {
    case endpointNotConfigured

    var errorDescription: String? {
        "A food-photo estimate requires a configured vision endpoint. No local macro inference is bundled."
    }
}

struct UnconfiguredFoodPhotoEstimationService: FoodPhotoEstimating {
    func estimate(imageData: Data) async throws -> FoodPhotoEstimate {
        throw FoodPhotoEstimationError.endpointNotConfigured
    }
}

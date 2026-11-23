import Foundation
import ImageIO
import Vision

struct NutritionOCRResult: Sendable {
    let rawText: String
    let confidence: Float
    let draft: FoodLogDraft
}

enum NutritionOCRError: LocalizedError {
    case invalidImage
    case noText

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "The selected file could not be decoded as an image."
        case .noText:
            return "No readable text was found. Try a sharper, well-lit label photo."
        }
    }
}

struct NutritionFactsOCRService {
    func recognize(imageData: Data) async throws -> NutritionOCRResult {
        guard let source = CGImageSourceCreateWithData(imageData as CFData, nil),
              let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            throw NutritionOCRError.invalidImage
        }
        let orientation = Self.orientation(of: source)

        let candidates: [(text: String, confidence: Float)] = try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
                let values = observations.compactMap { observation in
                    observation.topCandidates(1).first.map { ($0.string, $0.confidence) }
                }
                continuation.resume(returning: values)
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true

            do {
                try VNImageRequestHandler(
                    cgImage: cgImage,
                    orientation: orientation,
                    options: [:]
                ).perform([request])
            } catch {
                continuation.resume(throwing: error)
            }
        }

        guard !candidates.isEmpty else { throw NutritionOCRError.noText }
        let text = candidates.map(\.text).joined(separator: "\n")
        let confidence = candidates.map(\.confidence).reduce(0, +) / Float(candidates.count)

        var draft = FoodLogDraft.empty
        draft.name = "Nutrition Facts item"
        draft.source = .nutritionFactsPhoto
        draft.servingDescription = lineValue(
            in: text,
            pattern: #"serving\s+size\s*[:\-]?\s*([^\n]+)"#
        )
        draft.calories = value(in: text, pattern: #"calories\s*[:\-]?\s*(\d+(?:\.\d+)?)"#)
        draft.proteinGrams = value(in: text, pattern: #"protein\s*[:\-]?\s*(\d+(?:\.\d+)?)"#)
        draft.carbohydrateGrams = value(
            in: text,
            pattern: #"(?:total\s+)?carbohydrate\s*[:\-]?\s*(\d+(?:\.\d+)?)"#
        )
        draft.fatGrams = value(in: text, pattern: #"total\s+fat\s*[:\-]?\s*(\d+(?:\.\d+)?)"#)
        draft.fiberGrams = value(
            in: text,
            pattern: #"(?:dietary\s+)?fiber\s*[:\-]?\s*(\d+(?:\.\d+)?)"#
        )

        return NutritionOCRResult(rawText: text, confidence: confidence, draft: draft)
    }

    private func value(in text: String, pattern: String) -> Double {
        guard let expression = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let match = expression.firstMatch(
                in: text,
                range: NSRange(text.startIndex..., in: text)
              ),
              let range = Range(match.range(at: 1), in: text) else {
            return 0
        }
        return Double(text[range]) ?? 0
    }

    private func lineValue(in text: String, pattern: String) -> String {
        guard let expression = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let match = expression.firstMatch(
                in: text,
                range: NSRange(text.startIndex..., in: text)
              ),
              let range = Range(match.range(at: 1), in: text) else {
            return ""
        }
        return String(text[range]).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// The EXIF orientation stored in the image, so sideways phone photos
    /// are read the right way up.
    private static func orientation(of source: CGImageSource) -> CGImagePropertyOrientation {
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let raw = properties[kCGImagePropertyOrientation] as? UInt32,
              let orientation = CGImagePropertyOrientation(rawValue: raw) else {
            return .up
        }
        return orientation
    }
}

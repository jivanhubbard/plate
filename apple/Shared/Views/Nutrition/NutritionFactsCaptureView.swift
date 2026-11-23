import PhotosUI
import SwiftUI

struct NutritionFactsCaptureView: View {
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var result: NutritionOCRResult?
    @State private var draft = FoodLogDraft.empty
    @State private var isProcessing = false
    @State private var reviewedByUser = false
    @State private var confirmationMessage: String?
    @State private var errorMessage: String?

    private let ocrService = NutritionFactsOCRService()

    var body: some View {
        Form {
            Section {
                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Label("Choose Nutrition Facts photo", systemImage: "photo")
                }
                .disabled(isProcessing)

                if isProcessing {
                    ProgressView("Reading label on device…")
                }
            } footer: {
                Text("Vision extracts printed label text. It does not identify food from a general meal photo.")
            }

            if let result {
                Section("Recognition") {
                    LabeledContent(
                        "OCR confidence",
                        value: result.confidence.formatted(.percent.precision(.fractionLength(0)))
                    )
                    Text("Confidence describes text recognition, not nutrition accuracy. Check every value against the label.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    DisclosureGroup("Recognized text") {
                        Text(result.rawText)
                            .font(.caption.monospaced())
                            .textSelection(.enabled)
                    }
                }

                Section("Editable nutrition") {
                    TextField("Food name", text: $draft.name)
                    TextField("Serving", text: $draft.servingDescription)
                    macroField("Calories", value: $draft.calories)
                    macroField("Protein (g)", value: $draft.proteinGrams)
                    macroField("Carbohydrate (g)", value: $draft.carbohydrateGrams)
                    macroField("Fat (g)", value: $draft.fatGrams)
                    macroField("Fiber (g)", value: $draft.fiberGrams)
                }

                Section("Required review") {
                    Toggle("I checked and edited these values against the label", isOn: $reviewedByUser)

                    Button("Confirm reviewed draft") {
                        confirmationMessage = "Draft confirmed locally for this screen. Persistence is not implemented in this scaffold."
                    }
                    .disabled(!reviewedByUser || draft.name.trimmingCharacters(in: .whitespaces).isEmpty)

                    if let confirmationMessage {
                        Text(confirmationMessage)
                            .foregroundStyle(.green)
                    }
                }
            }
        }
        .onChange(of: selectedPhoto) {
            guard selectedPhoto != nil else { return }
            Task { await processSelectedPhoto() }
        }
        .alert(
            "Could not read label",
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

    private func macroField(_ title: String, value: Binding<Double>) -> some View {
        TextField(title, value: value, format: .number.precision(.fractionLength(0...1)))
            #if os(iOS)
            .keyboardType(.decimalPad)
            #endif
    }

    @MainActor
    private func processSelectedPhoto() async {
        guard let selectedPhoto else { return }
        isProcessing = true
        errorMessage = nil
        result = nil
        reviewedByUser = false
        confirmationMessage = nil
        defer { isProcessing = false }

        do {
            guard let data = try await selectedPhoto.loadTransferable(type: Data.self) else {
                throw NutritionOCRError.invalidImage
            }
            let recognized = try await ocrService.recognize(imageData: data)
            result = recognized
            draft = recognized.draft
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

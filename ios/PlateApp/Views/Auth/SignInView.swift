import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var supabase: SupabaseService
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isSubmitting = false

    let onSignedIn: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    SecureField("Password", text: $password)
                        .textContentType(.password)
                }

                if let configurationError = supabase.configurationError {
                    Text(configurationError)
                        .foregroundStyle(.red)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                }

                Button {
                    signIn()
                } label: {
                    if isSubmitting {
                        ProgressView()
                    } else {
                        Text("Sign in")
                    }
                }
                .disabled(email.isEmpty || password.isEmpty || isSubmitting || supabase.client == nil)
            }
            .navigationTitle("Plate")
        }
    }

    private func signIn() {
        isSubmitting = true
        errorMessage = nil

        Task {
            defer { isSubmitting = false }
            do {
                try await supabase.signIn(email: email, password: password)
                onSignedIn()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

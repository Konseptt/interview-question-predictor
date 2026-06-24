## 2024-05-18 - Prevent Leaking Upstream API Errors to Client
**Vulnerability:** The application was directly returning raw upstream API error responses (`response.text()`) and internal exception messages (`error.message`) to the client when API calls failed.
**Learning:** Returning raw external API responses or stack trace details can accidentally leak sensitive infrastructure details, tokens, or system configurations to an attacker.
**Prevention:** Always catch and log raw external API errors and exceptions on the server. Return only generic, sanitized error messages (e.g., "NVIDIA request failed.", "Unexpected streaming error.") to the client.

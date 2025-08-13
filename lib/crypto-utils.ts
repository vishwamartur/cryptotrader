// Browser-compatible crypto utilities for HMAC-SHA256 signature generation

export async function generateHmacSha256(message: string, secret: string): Promise<string> {
  // Check if we're in a browser environment
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    // Use Web Crypto API for browser
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(message)

    const cryptoKey = await window.crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
    ])

    const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, messageData)
    const hashArray = Array.from(new Uint8Array(signature))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  } else {
    // Use Node.js crypto for server-side
    const crypto = await import("crypto")
    return crypto.createHmac("sha256", secret).update(message).digest("hex")
  }
}

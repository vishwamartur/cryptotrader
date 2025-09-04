import { NextResponse } from "next/server";
import { getDeltaCredentials } from "@/lib/delta-exchange";
import { validateCredentials, getCredentialSuggestions } from "@/lib/delta-credential-validator";

export async function GET() {
  try {
    console.log('[Credential Validation] Starting comprehensive credential validation...');
    
    // Get credentials from environment
    const credentials = getDeltaCredentials();
    
    console.log(`[Credential Validation] Testing credentials for API key: ${credentials.apiKey.substring(0, 8)}...${credentials.apiKey.slice(-4)}`);
    
    // Validate credentials comprehensively
    const validationResult = await validateCredentials(credentials.apiKey, credentials.apiSecret);
    
    if (validationResult.isValid) {
      console.log('[Credential Validation] ✅ All validation tests passed');
      return NextResponse.json({
        success: true,
        message: "Delta Exchange API credentials are valid and have all required permissions",
        data: {
          apiKeyMasked: `${credentials.apiKey.substring(0, 8)}...${credentials.apiKey.slice(-4)}`,
          validationDetails: validationResult.details,
          suggestions: validationResult.suggestions,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      console.log('[Credential Validation] ❌ Validation failed:', validationResult.error);
      return NextResponse.json({
        success: false,
        error: "Credential validation failed",
        details: validationResult.error,
        validationDetails: validationResult.details,
        suggestions: validationResult.suggestions,
        code: "VALIDATION_FAILED"
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('[Credential Validation] Error during validation:', error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const suggestions = getCredentialSuggestions(errorMessage);
    
    // Handle specific error types
    if (errorMessage.includes("credentials not found") || errorMessage.includes("credentials are required")) {
      return NextResponse.json({
        success: false,
        error: "Delta Exchange API credentials not configured",
        details: "Please set DELTA_EXCHANGE_API_KEY and DELTA_EXCHANGE_API_SECRET environment variables",
        suggestions: [
          "Get your API credentials from: https://www.delta.exchange/app/api-management",
          "Set DELTA_EXCHANGE_API_KEY in your environment",
          "Set DELTA_EXCHANGE_API_SECRET in your environment",
          "Restart the application after setting credentials"
        ],
        code: "MISSING_CREDENTIALS"
      }, { status: 400 });
    }
    
    if (errorMessage.includes("invalid_api_key")) {
      return NextResponse.json({
        success: false,
        error: "Invalid Delta Exchange API credentials",
        details: errorMessage,
        suggestions,
        code: "INVALID_CREDENTIALS"
      }, { status: 401 });
    }
    
    if (errorMessage.includes("insufficient_permissions")) {
      return NextResponse.json({
        success: false,
        error: "Insufficient API permissions",
        details: errorMessage,
        suggestions,
        code: "INSUFFICIENT_PERMISSIONS"
      }, { status: 403 });
    }
    
    return NextResponse.json({
      success: false,
      error: "Credential validation failed",
      details: errorMessage,
      suggestions,
      code: "VALIDATION_ERROR"
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, apiSecret } = body;
    
    if (!apiKey || !apiSecret) {
      return NextResponse.json({
        success: false,
        error: "API key and secret are required",
        details: "Please provide both apiKey and apiSecret in the request body",
        code: "MISSING_PARAMETERS"
      }, { status: 400 });
    }
    
    console.log(`[Credential Validation] Testing provided credentials for API key: ${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`);
    
    // Validate provided credentials
    const validationResult = await validateCredentials(apiKey, apiSecret);
    
    if (validationResult.isValid) {
      console.log('[Credential Validation] ✅ Provided credentials are valid');
      return NextResponse.json({
        success: true,
        message: "Provided Delta Exchange API credentials are valid and have all required permissions",
        data: {
          apiKeyMasked: `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`,
          validationDetails: validationResult.details,
          suggestions: validationResult.suggestions,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      console.log('[Credential Validation] ❌ Provided credentials validation failed:', validationResult.error);
      return NextResponse.json({
        success: false,
        error: "Provided credential validation failed",
        details: validationResult.error,
        validationDetails: validationResult.details,
        suggestions: validationResult.suggestions,
        code: "VALIDATION_FAILED"
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('[Credential Validation] Error validating provided credentials:', error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const suggestions = getCredentialSuggestions(errorMessage);
    
    return NextResponse.json({
      success: false,
      error: "Credential validation failed",
      details: errorMessage,
      suggestions,
      code: "VALIDATION_ERROR"
    }, { status: 500 });
  }
}

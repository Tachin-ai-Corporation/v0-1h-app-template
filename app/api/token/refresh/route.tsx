import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { emitRequestLog, emitResponseLog, emitInfoLog, emitErrorLog } from "@/lib/debug-log-emitter"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_token_expires_in?: number
  token_type: string
  scope?: string
  id_token?: string
}

export async function POST() {
  const debugInfo: {
    step: string
    baseUrl?: string
    tokenUrl?: string
    requestBody?: string
    responseStatus?: number
    responseBody?: string
    error?: string
  } = { step: "init" }

  emitInfoLog("token-refresh", "Starting token refresh")

  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get("refresh_token")?.value
    let baseUrl = process.env.NEXT_PUBLIC_1H_URL || "https://app.1health.io"
    // Remove trailing /api or /api/ if present - OAuth endpoint is at root, not under /api
    baseUrl = baseUrl.replace(/\/api\/?$/, "")

    debugInfo.step = "url_resolved"
    debugInfo.baseUrl = baseUrl

    if (!refreshToken) {
      debugInfo.step = "no_refresh_token"
      debugInfo.error = "No refresh token found in cookies"
      emitErrorLog("token-refresh", "No refresh token found in cookies")
      return NextResponse.json(
        {
          error: "No refresh token available",
          debug: debugInfo,
        },
        { status: 401 },
      )
    }

    const tokenUrl = `${baseUrl}/auth/oauth2/token`
    debugInfo.tokenUrl = tokenUrl

    const requestBody = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=public-client`
    // Store redacted version for debug
    debugInfo.requestBody = `grant_type=refresh_token&refresh_token=[TOKEN_LENGTH:${refreshToken.length}]&client_id=public-client`
    debugInfo.step = "making_request"

    emitRequestLog(
      "token-refresh",
      "POST",
      tokenUrl,
      { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      debugInfo.requestBody,
    )

    const startTime = Date.now()
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: requestBody,
    })
    const duration = Date.now() - startTime

    debugInfo.responseStatus = response.status
    debugInfo.step = "response_received"

    const responseText = await response.text()
    debugInfo.responseBody = responseText

    emitResponseLog(
      "token-refresh",
      "POST",
      tokenUrl,
      response.status,
      response.statusText,
      Object.fromEntries(response.headers.entries()),
      responseText.length > 500 ? responseText.substring(0, 500) + "...[TRUNCATED]" : responseText,
      duration,
    )

    if (!response.ok) {
      debugInfo.step = "response_error"
      debugInfo.error = `1health returned ${response.status}`
      emitErrorLog("token-refresh", `Token refresh failed: ${response.status}`, { responseBody: responseText })
      return NextResponse.json(
        {
          error: "Failed to refresh token",
          details: responseText,
          debug: debugInfo,
        },
        { status: response.status },
      )
    }

    let data: TokenResponse
    try {
      data = JSON.parse(responseText)
      debugInfo.step = "success"
    } catch (e) {
      debugInfo.step = "parse_error"
      debugInfo.error = "Failed to parse response as JSON"
      emitErrorLog("token-refresh", "Failed to parse response as JSON", { responseBody: responseText })
      return NextResponse.json(
        {
          error: "Invalid response from 1health",
          details: responseText,
          debug: debugInfo,
        },
        { status: 500 },
      )
    }

    emitInfoLog("token-refresh", "Token refresh successful, updating cookies", {
      accessTokenLength: data.access_token?.length,
      refreshTokenLength: data.refresh_token?.length,
      expiresIn: data.expires_in,
    })

    const res = NextResponse.json({
      success: true,
      debug: debugInfo,
    })

    const accessTokenMaxAge = data.expires_in || 3600
    const refreshTokenMaxAge = accessTokenMaxAge * 2
    const tokenExpiresAt = Math.floor(Date.now() / 1000) + accessTokenMaxAge
    const refreshTokenExpiresAt = Math.floor(Date.now() / 1000) + refreshTokenMaxAge

    res.cookies.set("access_token", data.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: accessTokenMaxAge,
      path: "/",
    })

    res.cookies.set("refresh_token", data.refresh_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: refreshTokenMaxAge,
      path: "/",
    })

    res.cookies.set("token_expires_at", tokenExpiresAt.toString(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: accessTokenMaxAge,
      path: "/",
    })

    res.cookies.set("refresh_token_expires_at", refreshTokenExpiresAt.toString(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: refreshTokenMaxAge,
      path: "/",
    })

    return res
  } catch (error) {
    debugInfo.step = "exception"
    debugInfo.error = String(error)
    emitErrorLog("token-refresh", `Exception during refresh: ${String(error)}`)
    return NextResponse.json(
      {
        error: "Internal server error during token refresh",
        debug: debugInfo,
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Token refresh endpoint. Use POST to refresh tokens.",
    method: "POST",
  })
}

import { cookies } from "next/headers"
import { NextResponse } from "next/server"

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

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: requestBody,
    })

    debugInfo.responseStatus = response.status
    debugInfo.step = "response_received"

    const responseText = await response.text()
    debugInfo.responseBody = responseText

    if (!response.ok) {
      debugInfo.step = "response_error"
      debugInfo.error = `1health returned ${response.status}`
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
      return NextResponse.json(
        {
          error: "Invalid response from 1health",
          details: responseText,
          debug: debugInfo,
        },
        { status: 500 },
      )
    }

    const res = NextResponse.json({
      success: true,
      debug: debugInfo,
    })

    const accessTokenMaxAge = data.expires_in || 3600
    const refreshTokenMaxAge = 7 * 24 * 60 * 60 // 7 days
    const tokenExpiresAt = Math.floor(Date.now() / 1000) + accessTokenMaxAge
    const refreshTokenExpiresAt = data.refresh_token_expires_in
      ? Math.floor(Date.now() / 1000) + data.refresh_token_expires_in
      : Math.floor(Date.now() / 1000) + refreshTokenMaxAge

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

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
  console.log("[v0] Token refresh route called")

  const cookieStore = await cookies()
  const refreshToken = cookieStore.get("refresh_token")?.value
  let baseUrl = process.env.NEXT_PUBLIC_1H_URL || "https://app.1health.io"
  // Remove trailing /api or /api/ if present - OAuth endpoint is at root, not under /api
  baseUrl = baseUrl.replace(/\/api\/?$/, "")

  console.log("[v0] Base URL for OAuth (after stripping /api):", baseUrl)

  if (!refreshToken) {
    console.log("[v0] No refresh token found in cookies")
    return NextResponse.json({ error: "No refresh token available" }, { status: 401 })
  }

  console.log("[v0] Found refresh token, length:", refreshToken.length)

  try {
    const tokenUrl = `${baseUrl}/auth/oauth2/token`
    console.log("[v0] Calling 1health OAuth endpoint:", tokenUrl)

    const requestBody = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=public-client`
    console.log(
      "[v0] Request body (token redacted):",
      `grant_type=refresh_token&refresh_token=[REDACTED]&client_id=public-client`,
    )

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: requestBody,
    })

    console.log("[v0] 1health refresh response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.log("[v0] 1health refresh error:", errorText)
      return NextResponse.json({ error: "Failed to refresh token", details: errorText }, { status: response.status })
    }

    const data: TokenResponse = await response.json()
    console.log("[v0] Token refresh successful, expires_in:", data.expires_in)

    const res = NextResponse.json({ success: true })

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
    console.error("[v0] Token refresh error:", error)
    return NextResponse.json({ error: "Internal server error during token refresh" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Token refresh endpoint. Use POST to refresh tokens.",
    method: "POST",
  })
}

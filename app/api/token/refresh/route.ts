/**
 * Token Refresh API Route
 *
 * This endpoint is used internally by the auth service to refresh tokens.
 * It can also be called directly from the client if needed.
 *
 * POST /api/token/refresh
 * Body: { refreshToken?: string } - Optional, will use cookie if not provided
 */

import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const cookieStore = await cookies()

    // Use provided refresh token or get from cookies
    const refreshToken = body.refreshToken || cookieStore.get("refresh_token")?.value

    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token available" }, { status: 401 })
    }

    const urlFromCookie = cookieStore.get("onehealth_base_url")?.value
    const authUrl = urlFromCookie ? decodeURIComponent(urlFromCookie) : process.env.NEXT_PUBLIC_1H_URL

    if (!authUrl) {
      return NextResponse.json({ error: "Server configuration error: missing 1health URL" }, { status: 500 })
    }

    const response = await fetch(authUrl + "/auth/oauth2/token", {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=public-client`,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json({ error: "Token refresh failed", details: errorData }, { status: response.status })
    }

    const data = await response.json()

    // Update cookies with new tokens
    const accessTokenMaxAge = data.expires_in || 3600
    const refreshTokenMaxAge = 60 * 60 * 24 * 7 // 7 days

    cookieStore.set("access_token", data.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: accessTokenMaxAge,
      path: "/",
    })

    if (data.refresh_token) {
      cookieStore.set("refresh_token", data.refresh_token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: refreshTokenMaxAge,
        path: "/",
      })
    }

    const tokenExpiresAt = Date.now() + accessTokenMaxAge * 1000
    cookieStore.set("token_expires_at", String(tokenExpiresAt), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: refreshTokenMaxAge,
      path: "/",
    })

    return NextResponse.json({
      success: true,
      access_token: data.access_token,
      expires_in: data.expires_in,
      expires_at: tokenExpiresAt,
    })
  } catch (error) {
    console.error("[token/refresh] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

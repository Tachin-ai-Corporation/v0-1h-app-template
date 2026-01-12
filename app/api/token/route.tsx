// app/api/token/route.ts
import { NextResponse } from "next/server"
import { createDecipheriv, createHmac } from "crypto"
import { cookies } from "next/headers"

interface AuthResponse {
  id: string
  scope: string
  token_type: string
  access_token: string
  expires_in: number
  refresh_token: string
}

interface DecryptedPayload {
  required: {
    apiKey: {
      name: string
    }
    tenant: {
      id: number
    }
    user: {
      id: number
    }
    oneTimeCode: {
      value: string
      issuedAt: string
      expiresAt: string
    }
  }
  optional?: {
    license?: string
    user_first_name?: string
    user_last_name?: string
    provider_1health_id?: string
    provider_npi?: string
    workflow_id?: string
    journey_id?: string
    journey_step_id?: string
    encounter_id?: string
    [key: string]: string | undefined
  }
}

/**
 * Derives a 256-bit AES key from the JWT token using HKDF-SHA256.
 * Matches Java's KeyDerivationUtil.derive() implementation.
 * Uses empty salt (defaults to 32 zeros) and empty info.
 */
function deriveKey(value: string): Buffer {
  const KEY_LENGTH_BYTES = 32 // 256 bits
  const inputKeyMaterial = Buffer.from(value, "utf8")

  // HKDF-Extract: PRK = HMAC-Hash(salt, IKM)
  // When salt is empty, it defaults to a string of zeros
  const salt = Buffer.alloc(32, 0)
  const prk = createHmac("sha256", salt).update(inputKeyMaterial).digest()

  // HKDF-Expand: OKM = HMAC-Hash(PRK, T(0) | info | 0x01)
  // When info is empty, we just use counter
  const info = Buffer.alloc(0)
  const okm = Buffer.alloc(KEY_LENGTH_BYTES)

  let currentT = Buffer.alloc(0)
  let offset = 0

  for (let i = 1; offset < KEY_LENGTH_BYTES; i++) {
    const hmac = createHmac("sha256", prk)
    hmac.update(currentT)
    hmac.update(info)
    hmac.update(Buffer.from([i]))
    currentT = hmac.digest()

    const bytesToCopy = Math.min(currentT.length, KEY_LENGTH_BYTES - offset)
    currentT.copy(okm, offset, 0, bytesToCopy)
    offset += bytesToCopy
  }

  return okm
}

/**
 * AES-256-GCM decrypt helper
 */
function decryptAesGcm({
  iv,
  tag,
  encryptedData,
  key,
}: {
  iv: Buffer
  tag: Buffer
  encryptedData: Buffer
  key: Buffer
}): string {
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  // Decrypt
  let decrypted = decipher.update(encryptedData)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString("utf8")
}

/**
 * POST /api/token
 * Body:
 * {
 *   "lpl": "<base64>"  // IV (first 12 bytes) + ciphertext + tag (last 16 bytes)
 * }
 */
export async function POST(req: Request) {
  try {
    console.log("[v0] POST /api/token - Starting token exchange")

    const cookieStore = await cookies()
    const envOneHealthUrl = process.env.NEXT_PUBLIC_1H_URL

    if (envOneHealthUrl) {
      const currentCookieUrl = cookieStore.get("onehealth_base_url")?.value
      const decodedCurrentUrl = currentCookieUrl ? decodeURIComponent(currentCookieUrl) : null

      if (decodedCurrentUrl !== envOneHealthUrl) {
        console.log("[v0] Refreshing onehealth_base_url cookie:", {
          old: decodedCurrentUrl || "(not set)",
          new: envOneHealthUrl,
        })

        cookieStore.set("onehealth_base_url", encodeURIComponent(envOneHealthUrl), {
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: "/",
        })
      }
    }

    const body = await req.json()

    if (!body.lpl) {
      console.error("[v0] Missing LPL in request body")
      return NextResponse.json({ error: "Missing required field: lpl is required" }, { status: 400 })
    }

    console.log("[v0] LPL received, length:", body.lpl.length)

    const secretKey = process.env.ONEHEALTH_SECRET_KEY
    if (!secretKey) {
      console.error("[v0] ONEHEALTH_SECRET_KEY environment variable not set")
      return NextResponse.json({ error: "Server configuration error: missing secret key" }, { status: 500 })
    }

    console.log("[v0] Secret key found, attempting to decrypt LPL")

    let lpl: Buffer
    try {
      lpl = Buffer.from(body.lpl, "base64")
      console.log("[v0] LPL decoded from base64, buffer length:", lpl.length)
    } catch (err) {
      console.error("[v0] Failed to decode LPL from base64:", err)
      return NextResponse.json({ error: "Invalid LPL format: not valid base64" }, { status: 400 })
    }

    // Structure: IV (12 bytes) + ciphertext + tag (16 bytes)
    const IV_LENGTH = 12
    const TAG_LENGTH = 16

    if (lpl.length < IV_LENGTH + TAG_LENGTH) {
      console.error("[v0] LPL too short:", lpl.length, "bytes (minimum:", IV_LENGTH + TAG_LENGTH, ")")
      return NextResponse.json({ error: "Invalid LPL format: payload too short" }, { status: 400 })
    }

    const iv = lpl.subarray(0, IV_LENGTH)
    const ciphertext = lpl.subarray(IV_LENGTH)
    const tag = ciphertext.subarray(ciphertext.length - TAG_LENGTH)
    const encryptedData = ciphertext.subarray(0, ciphertext.length - TAG_LENGTH)

    // Derive encryption key from the JWT API key using HKDF-SHA256
    const key = deriveKey(secretKey)

    let decryptedString: string
    try {
      decryptedString = decryptAesGcm({ iv, tag, encryptedData, key })
      console.log("[v0] LPL decrypted successfully, length:", decryptedString.length)
    } catch (err) {
      console.error("[v0] Failed to decrypt LPL:", err)
      return NextResponse.json(
        { error: "Invalid LPL: decryption failed. The payload may be corrupted or encrypted with a different key." },
        { status: 400 },
      )
    }

    let payload: DecryptedPayload
    try {
      payload = JSON.parse(decryptedString)
      console.log("[v0] Payload parsed successfully:", {
        hasRequired: !!payload.required,
        hasOptional: !!payload.optional,
        userId: payload.required?.user?.id,
        tenantId: payload.required?.tenant?.id,
      })
    } catch (err) {
      console.error("[v0] Failed to parse decrypted payload as JSON:", err)
      return NextResponse.json({ error: "Invalid payload format: decrypted data is not valid JSON" }, { status: 400 })
    }

    if (
      !payload.required ||
      !payload.required.apiKey?.name ||
      !payload.required.tenant?.id ||
      !payload.required.user?.id ||
      !payload.required.oneTimeCode?.value
    ) {
      console.error("[v0] Payload missing required fields:", {
        hasRequired: !!payload.required,
        hasApiKey: !!payload.required?.apiKey?.name,
        hasTenant: !!payload.required?.tenant?.id,
        hasUser: !!payload.required?.user?.id,
        hasOneTimeCode: !!payload.required?.oneTimeCode?.value,
      })
      return NextResponse.json({ error: "Invalid launch payload: missing required fields" }, { status: 400 })
    }

    // Generate HMAC-SHA256 signature using the ORIGINAL secret key (not derived)
    const signature = createHmac("sha256", Buffer.from(secretKey, "utf8"))
      .update(payload.required.oneTimeCode.value, "utf8")
      .digest("base64")

    const securityCode = payload.required.oneTimeCode.value

    const urlFromCookie = cookieStore.get("onehealth_base_url")?.value
    const authUrl = urlFromCookie ? decodeURIComponent(urlFromCookie) : process.env.NEXT_PUBLIC_1H_URL

    console.log("[v0] Resolving 1health URL:", {
      fromCookie: urlFromCookie || "(not set)",
      fromEnv: process.env.NEXT_PUBLIC_1H_URL || "(not set)",
      resolved: authUrl || "(MISSING)",
    })

    if (!authUrl) {
      console.error("[v0] No 1health URL available - cannot exchange token")
      return NextResponse.json(
        {
          error:
            "Authentication configuration error: No 1health URL available. Please return to 1health and access this app via the /auth endpoint.",
          details:
            "The app needs to know which 1health instance to authenticate with. This is normally captured from the referrer when you access /auth.",
        },
        { status: 500 },
      )
    }

    const tokenExchangeUrl = `${authUrl}/api/v2/public/external-application/auth/oauth2/user/token`
    console.log("[v0] Exchanging one-time code for tokens at:", tokenExchangeUrl)

    let authRes: Response
    try {
      authRes = await fetch(tokenExchangeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature, securityCode }),
      })
      console.log("[v0] Token exchange response status:", authRes.status, authRes.statusText)
    } catch (err) {
      console.error("[v0] Failed to connect to 1health for token exchange:", err)
      return NextResponse.json(
        {
          error: "Failed to connect to 1health authentication service",
          details: String(err),
        },
        { status: 502 },
      )
    }

    const authData: AuthResponse = await authRes.json()
    console.log("[v0] Token exchange response data:", {
      success: authRes.ok,
      hasAccessToken: !!authData.access_token,
      hasRefreshToken: !!authData.refresh_token,
      expiresIn: authData.expires_in,
    })

    if (!authRes.ok) {
      console.error("[v0] Token exchange failed:", authData)
      return NextResponse.json(
        {
          error: "Authentication failed",
          details: authData,
          statusCode: authRes.status,
        },
        { status: authRes.status },
      )
    }

    // Set cookies for access_token and refresh_token
    const accessTokenMaxAge = authData.expires_in
    const refreshTokenMaxAge = 60 * 60 * 24 * 7 // 7 days

    cookieStore.set("access_token", authData.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: accessTokenMaxAge,
      path: "/",
    })

    cookieStore.set("refresh_token", authData.refresh_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: refreshTokenMaxAge,
      path: "/",
    })

    const tokenExpiresAt = Date.now() + accessTokenMaxAge * 1000
    cookieStore.set("token_expires_at", String(tokenExpiresAt), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: refreshTokenMaxAge,
      path: "/",
    })

    console.log("[v0] Tokens set successfully in cookies")

    try {
      const tenantUrl = `${authUrl}/api/v2/tenant`
      console.log("[v0] Fetching tenant info from:", tenantUrl)

      const tenantRes = await fetch(tenantUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authData.access_token}`,
          "Content-Type": "application/json",
        },
      })

      if (tenantRes.ok) {
        const tenantData = await tenantRes.json()
        console.log("[v0] Tenant info received:", {
          tenantId: tenantData.id,
          tenantName: tenantData.name,
          organizationId: tenantData.organization?.id,
        })

        // Store tenant org ID in cookie for client-side access
        if (tenantData.organization?.id) {
          cookieStore.set("user_org_id", String(tenantData.organization.id), {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: refreshTokenMaxAge,
            path: "/",
          })
        }

        // Store user ID from the decrypted payload
        cookieStore.set("user_id", String(payload.required.user.id), {
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: refreshTokenMaxAge,
          path: "/",
        })
      } else {
        console.error("[v0] Failed to fetch tenant info:", tenantRes.status, tenantRes.statusText)
      }
    } catch (tenantErr) {
      console.error("[v0] Error fetching tenant info:", tenantErr)
      // Non-fatal - continue with token response
    }

    return NextResponse.json(authData)
  } catch (err: any) {
    console.error("[v0] Unexpected error in /api/token:", err)

    return NextResponse.json(
      {
        error: "Unable to process the request",
        details: err.message || String(err),
      },
      { status: 500 },
    )
  }
}

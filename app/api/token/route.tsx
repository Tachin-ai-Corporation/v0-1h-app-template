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
  refresh_token_expires_in?: number
  id_token?: string
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

type Environment = "demo" | "prod"

const sessionCookieOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
  path: "/",
}

/**
 * Environment-aware configuration.
 * Resolves the correct secret key and base URL based on the chosen environment.
 */
function getEnvConfig(environment: Environment) {
  const secretKey =
    environment === "demo"
      ? process.env.ONEHEALTH_SECRET_KEY_DEMO
      : process.env.ONEHEALTH_SECRET_KEY_PROD

  const baseUrl =
    environment === "demo"
      ? "https://demo.1health.io"
      : "https://app.1health.io"

  const appId =
    environment === "demo"
      ? process.env.APP_ID_DEMO
      : process.env.APP_ID_PROD

  return { secretKey, baseUrl, appId }
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
 *   "lpl": "<base64>",         // IV (first 12 bytes) + ciphertext + tag (last 16 bytes)
 *   "environment": "demo"|"prod"  // Which environment to authenticate against
 * }
 *
 * This is the ONLY server-side route that requires the ONEHEALTH_SECRET_KEY.
 * All subsequent API calls are made client-side.
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const body = await req.json()

    if (!body.lpl) {
      return NextResponse.json({ error: "Missing required field: lpl is required" }, { status: 400 })
    }

    const environment: Environment = body.environment === "prod" ? "prod" : "demo"
    const { secretKey, baseUrl } = getEnvConfig(environment)

    // Store the environment and base URL in cookies
    cookieStore.set("onehealth_environment", environment, {
      ...sessionCookieOptions,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    cookieStore.set("onehealth_base_url", baseUrl, {
      ...sessionCookieOptions,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    if (!secretKey) {
      return NextResponse.json(
        { error: `Server configuration error: missing secret key for ${environment} environment` },
        { status: 500 },
      )
    }

    let lpl: Buffer
    try {
      lpl = Buffer.from(body.lpl, "base64")
    } catch (err) {
      return NextResponse.json({ error: "Invalid LPL format: not valid base64" }, { status: 400 })
    }

    // Structure: IV (12 bytes) + ciphertext + tag (16 bytes)
    const IV_LENGTH = 12
    const TAG_LENGTH = 16

    if (lpl.length < IV_LENGTH + TAG_LENGTH) {
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
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid LPL: decryption failed. The payload may be corrupted or encrypted with a different key." },
        { status: 400 },
      )
    }

    let payload: DecryptedPayload
    try {
      payload = JSON.parse(decryptedString)
    } catch (err) {
      return NextResponse.json({ error: "Invalid payload format: decrypted data is not valid JSON" }, { status: 400 })
    }

    if (
      !payload.required ||
      !payload.required.apiKey?.name ||
      !payload.required.tenant?.id ||
      !payload.required.user?.id ||
      !payload.required.oneTimeCode?.value
    ) {
      return NextResponse.json({ error: "Invalid launch payload: missing required fields" }, { status: 400 })
    }

    // Generate HMAC-SHA256 signature using the ORIGINAL secret key (not derived)
    const signature = createHmac("sha256", Buffer.from(secretKey, "utf8"))
      .update(payload.required.oneTimeCode.value, "utf8")
      .digest("base64")

    const securityCode = payload.required.oneTimeCode.value

    const tokenExchangeUrl = `${baseUrl}/api/v2/public/external-application/auth/oauth2/user/token`

    let authRes: Response
    try {
      authRes = await fetch(tokenExchangeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature, securityCode }),
      })
    } catch (err) {
      return NextResponse.json(
        {
          error: "Failed to connect to 1health authentication service",
          details: String(err),
        },
        { status: 502 },
      )
    }

    const authData: AuthResponse = await authRes.json()

    if (!authRes.ok) {
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
    const refreshTokenMaxAge = accessTokenMaxAge * 2

    cookieStore.set("access_token", authData.access_token, {
      ...sessionCookieOptions,
      maxAge: accessTokenMaxAge,
    })

    cookieStore.set("refresh_token", authData.refresh_token, {
      ...sessionCookieOptions,
      maxAge: refreshTokenMaxAge,
    })

    const tokenExpiresAt = Math.floor(Date.now() / 1000) + accessTokenMaxAge
    const refreshExpiresAt = Math.floor(Date.now() / 1000) + refreshTokenMaxAge

    cookieStore.set("refresh_token_expires_at", String(refreshExpiresAt), {
      ...sessionCookieOptions,
      maxAge: refreshTokenMaxAge,
    })

    cookieStore.set("token_expires_at", String(tokenExpiresAt), {
      ...sessionCookieOptions,
      maxAge: refreshTokenMaxAge,
    })

    cookieStore.set("user_id", String(payload.required.user.id), {
      ...sessionCookieOptions,
      maxAge: refreshTokenMaxAge,
    })
    cookieStore.set("user_tenant_id", String(payload.required.tenant.id), {
      ...sessionCookieOptions,
      maxAge: refreshTokenMaxAge,
    })

    try {
      const tenantUrl = `${baseUrl}/api/v2/tenant`

      const tenantRes = await fetch(tenantUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authData.access_token}`,
          "Content-Type": "application/json",
        },
      })

      if (tenantRes.ok) {
        const tenantData = await tenantRes.json()

        // Store tenant org ID in cookie for client-side access
        if (tenantData.organization?.id) {
          cookieStore.set("user_org_id", String(tenantData.organization.id), {
            ...sessionCookieOptions,
            maxAge: refreshTokenMaxAge,
          })
        }
      }
    } catch (tenantErr) {
      // Non-fatal - continue with token response
    }

    return NextResponse.json(authData)
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Unable to process the request",
        details: err.message || String(err),
      },
      { status: 500 },
    )
  }
}

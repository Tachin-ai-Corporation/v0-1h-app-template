/**
 * Centralized date and time formatting utilities
 * All functions support timezone parameter for server-side formatting
 */

/**
 * Formats an ISO date string to local date only (MM/DD/YYYY)
 * @param isoDate - ISO 8601 date string (e.g., "2024-12-31")
 * @param timezone - Optional IANA timezone string (e.g., "America/New_York")
 * @returns Formatted date string or empty string if null/empty
 */
export function formatDateLocal(isoDate: string | null | undefined, timezone?: string): string {
  if (!isoDate) return ""

  // For date-only strings (YYYY-MM-DD), parse as local date to avoid timezone shift
  if (isoDate.length === 10 && !isoDate.includes("T")) {
    const [year, month, day] = isoDate.split("-").map(Number)
    return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`
  }

  // For datetime strings, convert to specified timezone or local time
  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return ""

  if (timezone) {
    return date.toLocaleDateString("en-US", {
      timeZone: timezone,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    })
  }

  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const year = date.getFullYear()

  return `${month}/${day}/${year}`
}

/**
 * Formats an ISO datetime string to local datetime with timezone indicator (MM/DD/YYYY HH:MM AM/PM TZ)
 * @param isoDate - ISO 8601 datetime string
 * @param timezone - Optional IANA timezone string (e.g., "America/New_York"). Defaults to "America/Los_Angeles" (PST)
 * @returns Formatted datetime string with timezone or empty string if null
 */
export function formatDateTimeWithTimezone(isoDate: string | null | undefined, timezone?: string): string {
  if (!isoDate) return ""

  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return ""

  const tz = timezone || "America/Los_Angeles"

  return date.toLocaleString("en-US", {
    timeZone: tz,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  })
}

/**
 * Formats an ISO datetime string to local datetime without timezone (MM/DD/YYYY HH:MM)
 * @param isoDate - ISO 8601 datetime string
 * @param timezone - Optional IANA timezone string (e.g., "America/New_York")
 * @returns Formatted datetime string or empty string if null
 */
export function formatDateTimeLocal(isoDate: string | null | undefined, timezone?: string): string {
  if (!isoDate) return ""

  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return ""

  if (timezone) {
    // Use Intl.DateTimeFormat for timezone-aware formatting
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    const parts = formatter.formatToParts(date)
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || ""
    return `${getPart("month")}/${getPart("day")}/${getPart("year")} ${getPart("hour")}:${getPart("minute")}`
  }

  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${month}/${day}/${year} ${hours}:${minutes}`
}

/**
 * Formats duration in seconds to human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "2 days 5 hours")
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return ""

  const days = Math.floor(seconds / (60 * 60 * 24))
  const hours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60))
  const minutes = Math.floor((seconds % (60 * 60)) / 60)

  if (days > 0) {
    return hours > 0 ? `${days} days ${hours} hours` : `${days} days`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} hours ${minutes} minutes` : `${hours} hours`
  }
  if (minutes > 0) {
    return `${minutes} minutes`
  }
  return `${seconds} seconds`
}

/**
 * Gets the user's current timezone name
 * @returns Timezone string (e.g., "America/New_York")
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Gets the user's current timezone abbreviation
 * @returns Timezone abbreviation (e.g., "EST", "PST")
 */
export function getUserTimezoneAbbreviation(): string {
  const date = new Date()
  const timeZoneName = date.toLocaleString("en-US", {
    timeZoneName: "short",
  })
  // Extract just the timezone part (e.g., "EST" from "12/16/2024, 3:45 PM EST")
  const parts = timeZoneName.split(" ")
  return parts[parts.length - 1]
}

/**
 * Checks if a string looks like an ISO date/datetime string
 * @param value - String to check
 * @returns true if it looks like an ISO date string
 */
export function isISODateString(value: string): boolean {
  if (!value || typeof value !== "string") return false
  // Match ISO date (YYYY-MM-DD) or datetime (YYYY-MM-DDTHH:MM:SS)
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)
}

/**
 * Alias for formatDateLocal - formats an ISO date string to MM/DD/YYYY
 */
export const formatDate = formatDateLocal

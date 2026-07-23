/**
 * =============================================================================
 * 1health API — journey comments
 * =============================================================================
 *
 * Listing uses the grid family (`POST /api/v3/health/grid/comment`); posting
 * uses a per-journey endpoint whose body wraps an ARRAY of comments even for one.
 *
 * See docs/api/WORKFLOWS.md § Comments.
 * =============================================================================
 */

import { callApi, type ApiResponse } from "./client"
import { endpoints } from "./config"
import type { PaginatedResponse } from "./types"

/** Loosely-typed comment row; cast as needed. */
export type JourneyComment = Record<string, unknown>

/** List comments for a journey (grid-style query). */
export async function fetchJourneyComments(
  journeyId: number,
  page = 0,
  size = 20,
): Promise<ApiResponse<PaginatedResponse<JourneyComment>>> {
  const query = `?page=${page}&size=${size}&journeyUatStatus=All`
  return callApi<PaginatedResponse<JourneyComment>>(
    "comments/fetchJourneyComments",
    `${endpoints.commentGrid()}${query}`,
    {
      method: "POST",
      body: JSON.stringify({
        filterBy: [{ key: "journeyId", value: journeyId, operator: "equals" }],
        orderBy: [{ key: "created", order: "DESC" }],
      }),
    },
  )
}

/** Post a comment to a journey. Body wraps an array even for a single comment. */
export async function postJourneyComment(
  journeyId: number,
  content: string,
): Promise<ApiResponse<unknown>> {
  return callApi("comments/postJourneyComment", endpoints.journeyComment(journeyId), {
    method: "POST",
    body: JSON.stringify({ comments: [{ content }] }),
  })
}

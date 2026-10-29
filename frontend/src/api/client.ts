import type {
  Build,
  ConflictReport,
  CreateAccountRequest,
  CreateBuildRequest,
  CreateTeamRequest,
  GameAccount,
  MeResponse,
  PatchTeamRequest,
  PublicBuildResponse,
  PublicShowcaseRosterResponse,
  PublicTeamResponse,
  ShowcaseResponse,
  Team,
  TeamCountResponse,
  TeamDetail,
  TeamSummary,
  UpdateAccountRequest,
  UpdateBuildRequest,
  UpdateTeamRequest,
  VerificationChallengeRequest,
  VerificationChallengeResponse,
  VerificationConfirmRequest,
} from '@/types'

import { getCurrentLanguage } from '@/i18n'
import { savePostLoginRedirect } from '@/lib/auth-storage'

const BASE_URL = '/api/v1'

const FALLBACK_MESSAGES_RU: Record<number, string> = {
  400: 'Некорректный запрос',
  401: 'Требуется авторизация',
  403: 'Доступ запрещен',
  404: 'Не найдено',
  409: 'Конфликт данных',
  422: 'Команда отклонена движком конфликтов',
  429: 'Слишком много запросов, попробуйте позже',
  502: 'Источник игровых данных недоступен',
}

const FALLBACK_MESSAGES_EN: Record<number, string> = {
  400: 'Invalid request',
  401: 'Authorization required',
  403: 'Access denied',
  404: 'Not found',
  409: 'Data conflict',
  422: 'Squad rejected by conflict engine',
  429: 'Too many requests, please try again later',
  502: 'Game data source unavailable',
}

export class ApiError extends Error {
  readonly status: number
  readonly conflicts: ConflictReport | undefined

  constructor(status: number, message: string, conflicts?: ConflictReport) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.conflicts = conflicts
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  skipAuthRedirect?: boolean
}

function redirectToLogin() {
  if (window.location.pathname.startsWith('/login')) return
  savePostLoginRedirect(window.location.pathname)
  window.location.assign('/login')
}

async function parseErrorResponse(response: Response): Promise<{
  message: string
  conflicts?: ConflictReport
}> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const isEn = getCurrentLanguage() === 'en'
  const messages = isEn ? FALLBACK_MESSAGES_EN : FALLBACK_MESSAGES_RU
  const defaultError = isEn
    ? `Request error (${response.status})`
    : `Ошибка запроса (${response.status})`

  const record =
    typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
  const message =
    typeof record.error === 'string'
      ? record.error
      : (messages[response.status] ?? defaultError)
  const conflicts =
    typeof record.conflicts === 'object' && record.conflicts !== null
      ? (record.conflicts as ConflictReport)
      : undefined

  return { message, conflicts }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRedirect, headers, ...rest } = options

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Accept-Language': getCurrentLanguage(),
      'X-Requested-With': 'XMLHttpRequest',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : undefined),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const { message, conflicts } = await parseErrorResponse(response)
    if (response.status === 401 && !skipAuthRedirect) {
      redirectToLogin()
    }
    throw new ApiError(response.status, message, conflicts)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function fetchMe(signal?: AbortSignal): Promise<MeResponse> {
  return request<MeResponse>('/auth/me', { signal, skipAuthRedirect: true })
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' })
}

export function deleteMe(): Promise<void> {
  return request<void>('/auth/me', { method: 'DELETE' })
}

export function createAccount(body: CreateAccountRequest): Promise<GameAccount> {
  return request<GameAccount>('/accounts', { method: 'POST', body })
}

export function updateAccount(id: string, body: UpdateAccountRequest): Promise<GameAccount> {
  return request<GameAccount>(`/accounts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  })
}

export function deleteAccount(id: string): Promise<void> {
  return request<void>(`/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function startAccountVerification(id: string): Promise<VerificationChallengeResponse> {
  return request<VerificationChallengeResponse>(`/accounts/${encodeURIComponent(id)}/verify/challenge`, {
    method: 'POST',
  })
}

export function startVerificationByUID(
  body: VerificationChallengeRequest,
): Promise<VerificationChallengeResponse> {
  return request<VerificationChallengeResponse>('/accounts/verify/challenge', {
    method: 'POST',
    body,
  })
}

export function confirmAccountVerification(id: string): Promise<GameAccount> {
  return request<GameAccount>(`/accounts/${encodeURIComponent(id)}/verify/confirm`, {
    method: 'POST',
  })
}

export function confirmVerificationByUID(
  body: VerificationConfirmRequest,
): Promise<GameAccount> {
  return request<GameAccount>('/accounts/verify/confirm', {
    method: 'POST',
    body,
  })
}

export function fetchShowcase(
  uid: string,
  lang?: string,
  signal?: AbortSignal,
): Promise<ShowcaseResponse> {
  const activeLang = lang || getCurrentLanguage()
  const query = activeLang ? `?lang=${encodeURIComponent(activeLang)}` : ''
  return request<ShowcaseResponse>(`/showcase/${encodeURIComponent(uid)}${query}`, { signal })
}

export function fetchShowcaseRoster(
  uid: string,
  lang?: string,
  signal?: AbortSignal,
): Promise<PublicShowcaseRosterResponse> {
  const activeLang = lang || getCurrentLanguage()
  const query = activeLang ? `?lang=${encodeURIComponent(activeLang)}` : ''
  return request<PublicShowcaseRosterResponse>(`/showcase/${encodeURIComponent(uid)}/roster${query}`, {
    signal,
    skipAuthRedirect: true,
  })
}

export function fetchBuilds(
  gameAccountId: string,
  lang?: string,
  signal?: AbortSignal,
): Promise<Build[]> {
  const activeLang = lang || getCurrentLanguage()
  const langQuery = activeLang ? `&lang=${encodeURIComponent(activeLang)}` : ''
  return request<Build[]>(`/builds?game_account_id=${encodeURIComponent(gameAccountId)}${langQuery}`, {
    signal,
  })
}

export function createBuild(body: CreateBuildRequest): Promise<Build> {
  return request<Build>('/builds', { method: 'POST', body })
}

export function updateBuild(id: string, body: UpdateBuildRequest): Promise<void> {
  return request<void>(`/builds/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  })
}

export function renameBuild(id: string, name: string, description?: string | null): Promise<void> {
  return updateBuild(id, { name, description })
}

export function fetchPublicBuild(
  id: string,
  lang?: string,
  signal?: AbortSignal,
): Promise<PublicBuildResponse> {
  const activeLang = lang || getCurrentLanguage()
  const langQuery = activeLang ? `?lang=${encodeURIComponent(activeLang)}` : ''
  return request<PublicBuildResponse>(`/public/builds/${encodeURIComponent(id)}${langQuery}`, {
    signal,
    skipAuthRedirect: true,
  })
}

export function fetchPublicTeam(
  id: string,
  lang?: string,
  signal?: AbortSignal,
): Promise<PublicTeamResponse> {
  const activeLang = lang || getCurrentLanguage()
  const langQuery = activeLang ? `?lang=${encodeURIComponent(activeLang)}` : ''
  return request<PublicTeamResponse>(`/public/teams/${encodeURIComponent(id)}${langQuery}`, {
    signal,
    skipAuthRedirect: true,
  })
}

export function deleteBuild(id: string): Promise<void> {
  return request<void>(`/builds/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function fetchTeams(
  gameAccountId: string,
  lang?: string,
  signal?: AbortSignal,
): Promise<TeamSummary[]> {
  const activeLang = lang || getCurrentLanguage()
  const langQuery = activeLang ? `&lang=${encodeURIComponent(activeLang)}` : ''
  return request<TeamSummary[]>(`/teams?game_account_id=${encodeURIComponent(gameAccountId)}${langQuery}`, {
    signal,
  })
}

export function fetchTeam(id: string, lang?: string, signal?: AbortSignal): Promise<TeamDetail> {
  const activeLang = lang || getCurrentLanguage()
  const langQuery = activeLang ? `?lang=${encodeURIComponent(activeLang)}` : ''
  return request<TeamDetail>(`/teams/${encodeURIComponent(id)}${langQuery}`, { signal })
}

/**
 * Reads the team count for an account without downloading the team list.
 *
 * The list response embeds every member's full build payload, so a caller that
 * only needs to check the per-account team limit must not fetch it.
 */
export function fetchTeamCount(
  gameAccountId: string,
  signal?: AbortSignal,
): Promise<TeamCountResponse> {
  return request<TeamCountResponse>(
    `/teams/count?game_account_id=${encodeURIComponent(gameAccountId)}`,
    { signal },
  )
}

/**
 * Runs the Conflict Engine against a candidate composition.
 *
 * A GET rather than a POST: validation persists nothing, and a cacheable verb
 * lets the browser reuse the report for a composition it already checked. The
 * server answers with `Cache-Control: private, max-age=60`.
 */
export function validateTeam(
  buildIds: string[],
  signal?: AbortSignal,
): Promise<ConflictReport> {
  const query = buildIds.map((id) => encodeURIComponent(id)).join(',')
  return request<ConflictReport>(`/teams/validate?build_ids=${query}`, { signal })
}

export function createTeam(body: CreateTeamRequest): Promise<Team> {
  return request<Team>('/teams', { method: 'POST', body })
}

export function updateTeam(body: UpdateTeamRequest): Promise<Team> {
  const { id, ...rest } = body
  return request<Team>(`/teams/${encodeURIComponent(id)}`, { method: 'PUT', body: rest })
}

export function patchTeam(
  id: string,
  body: PatchTeamRequest,
  lang?: string,
): Promise<TeamSummary> {
  const activeLang = lang || getCurrentLanguage()
  const query = activeLang ? `?lang=${encodeURIComponent(activeLang)}` : ''
  return request<TeamSummary>(`/teams/${encodeURIComponent(id)}${query}`, {
    method: 'PATCH',
    body,
  })
}

export function deleteTeam(id: string): Promise<void> {
  return request<void>(`/teams/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

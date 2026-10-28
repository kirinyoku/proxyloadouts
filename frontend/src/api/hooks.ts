import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import i18n from '@/i18n'
import type {
  Build,
  CreateAccountRequest,
  CreateBuildRequest,
  CreateTeamRequest,
  GameAccount,
  MeResponse,
  UpdateTeamRequest,
} from '@/types'
import * as api from './client'

const AUTH_STALE_TIME = 60_000
const COLLECTION_STALE_TIME = 2 * 60_000
const SHOWCASE_STALE_TIME = 60_000
const VALIDATION_DEBOUNCE_MS = 300

// Stable empty reference so consumers do not re-render on every render while
// the session query is still loading.
const EMPTY_ACCOUNTS: GameAccount[] = []

interface QueryOptions {
  enabled?: boolean
}

function notifyMutationError(error: unknown, fallback: string) {
  toast.error(error instanceof api.ApiError ? error.message : fallback)
}

/**
 * Normalizes the active UI language to the two-letter key used in query keys.
 * Mutating code has no `useTranslation` hook in scope, so it reads the global
 * i18next instance — the same source the `Accept-Language` request header and
 * the `?lang=` query parameter are derived from.
 */
function currentLangKey(): 'ru' | 'en' {
  return i18n.language?.slice(0, 2) === 'en' ? 'en' : 'ru'
}

export const queryKeys = {
  me: ['auth', 'me'] as const,
  showcase: (uid: string, lang?: string) =>
    lang ? (['showcase', uid, lang] as const) : (['showcase', uid] as const),
  builds: (gameAccountId: string, lang?: string) =>
    lang ? (['builds', gameAccountId, lang] as const) : (['builds', gameAccountId] as const),
  teams: (gameAccountId: string, lang?: string) =>
    lang ? (['teams', gameAccountId, lang] as const) : (['teams', gameAccountId] as const),
  team: (id: string, lang?: string) =>
    lang ? (['teams', 'detail', id, lang] as const) : (['teams', 'detail', id] as const),
  teamCount: (gameAccountId: string) => ['teams', 'count', gameAccountId] as const,
  teamValidation: (buildIdsKey: string) => ['team-validation', buildIdsKey] as const,
  publicBuild: (id: string, lang?: string) =>
    lang ? (['public', 'build', id, lang] as const) : (['public', 'build', id] as const),
  publicTeam: (id: string, lang?: string) =>
    lang ? (['public', 'team', id, lang] as const) : (['public', 'team', id] as const),
}

/**
 * The session query. `options.enabled` is honoured here rather than being
 * ignored by a wrapper, so a caller that opts out does not trigger a request.
 */
function useMeQuery(options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }): Promise<MeResponse | null> => {
      try {
        return await api.fetchMe(signal)
      } catch (error) {
        // A guest is a valid state, not an error: normalizing 401 to null keeps
        // the header and the protected routes from flickering into an error
        // state, and avoids a redirect loop.
        if (error instanceof api.ApiError && error.status === 401) {
          return null
        }
        throw error
      }
    },
    enabled: options?.enabled ?? true,
    staleTime: AUTH_STALE_TIME,
  })
}

export function useMe() {
  return useMeQuery()
}

interface AccountsResult {
  data: GameAccount[]
  isPending: boolean
}

/**
 * Returns the linked game accounts, derived from the session query.
 *
 * `GET /auth/me` already carries the full account list, so this deliberately
 * issues no request of its own: a separate `GET /accounts` query fired in
 * parallel on every account-aware page and duplicated a round trip whose
 * response was already in flight.
 */
export function useAccounts(options?: QueryOptions): AccountsResult {
  const enabled = options?.enabled ?? true
  const meQuery = useMeQuery({ enabled })

  const data = useMemo(
    () => (enabled ? (meQuery.data?.accounts ?? EMPTY_ACCOUNTS) : EMPTY_ACCOUNTS),
    [enabled, meQuery.data],
  )

  return { data, isPending: enabled && meQuery.isPending }
}

export function useShowcase(uid: string) {
  const { i18n: i18nInstance } = useTranslation()
  const langKey = i18nInstance.language?.slice(0, 2) === 'en' ? 'en' : 'ru'

  return useQuery({
    queryKey: queryKeys.showcase(uid, langKey),
    queryFn: ({ signal }) => api.fetchShowcase(uid, langKey, signal),
    enabled: uid.trim().length > 0,
    staleTime: SHOWCASE_STALE_TIME,
  })
}

export function useBuilds(gameAccountId: string | undefined, options?: QueryOptions) {
  const { i18n: i18nInstance } = useTranslation()
  const langKey = i18nInstance.language?.slice(0, 2) === 'en' ? 'en' : 'ru'

  return useQuery({
    queryKey: queryKeys.builds(gameAccountId ?? '', langKey),
    queryFn: ({ signal }) =>
      gameAccountId
        ? api.fetchBuilds(gameAccountId, langKey, signal)
        : Promise.reject(new Error('game_account_id is required')),
    enabled: Boolean(gameAccountId) && (options?.enabled ?? true),
    staleTime: COLLECTION_STALE_TIME,
  })
}

export function useTeams(gameAccountId: string | undefined, options?: QueryOptions) {
  const { i18n: i18nInstance } = useTranslation()
  const langKey = i18nInstance.language?.slice(0, 2) === 'en' ? 'en' : 'ru'

  return useQuery({
    queryKey: queryKeys.teams(gameAccountId ?? '', langKey),
    queryFn: ({ signal }) =>
      gameAccountId
        ? api.fetchTeams(gameAccountId, langKey, signal)
        : Promise.reject(new Error('game_account_id is required')),
    enabled: Boolean(gameAccountId) && (options?.enabled ?? true),
    staleTime: COLLECTION_STALE_TIME,
  })
}

export function useTeam(id: string | undefined) {
  const { i18n: i18nInstance } = useTranslation()
  const langKey = i18nInstance.language?.slice(0, 2) === 'en' ? 'en' : 'ru'

  return useQuery({
    queryKey: queryKeys.team(id ?? '', langKey),
    queryFn: ({ signal }) =>
      id ? api.fetchTeam(id, langKey, signal) : Promise.reject(new Error('team id is required')),
    enabled: Boolean(id),
    staleTime: COLLECTION_STALE_TIME,
  })
}

/**
 * Returns how many teams exist on a game account.
 *
 * Deliberately a separate, tiny query instead of a read off `useTeams`: the
 * team list embeds every member's complete build payload, so the team builder
 * used to download dozens of localized agent objects to read one number and
 * compare it against the per-account limit.
 */
export function useTeamCount(gameAccountId: string | undefined, options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.teamCount(gameAccountId ?? ''),
    queryFn: ({ signal }) =>
      gameAccountId
        ? api.fetchTeamCount(gameAccountId, signal)
        : Promise.reject(new Error('game_account_id is required')),
    enabled: Boolean(gameAccountId) && (options?.enabled ?? true),
    // A stale count only affects whether the save button is disabled; the
    // server rejects an over-limit create regardless.
    staleTime: COLLECTION_STALE_TIME,
  })
}

export function usePublicBuild(id: string | undefined) {
  const { i18n: i18nInstance } = useTranslation()
  const langKey = i18nInstance.language?.slice(0, 2) === 'en' ? 'en' : 'ru'

  return useQuery({
    queryKey: queryKeys.publicBuild(id ?? '', langKey),
    queryFn: ({ signal }) =>
      id
        ? api.fetchPublicBuild(id, langKey, signal)
        : Promise.reject(new Error('build id is required')),
    enabled: Boolean(id),
    staleTime: COLLECTION_STALE_TIME,
  })
}

export function usePublicTeam(id: string | undefined) {
  const { i18n: i18nInstance } = useTranslation()
  const langKey = i18nInstance.language?.slice(0, 2) === 'en' ? 'en' : 'ru'

  return useQuery({
    queryKey: queryKeys.publicTeam(id ?? '', langKey),
    queryFn: ({ signal }) =>
      id
        ? api.fetchPublicTeam(id, langKey, signal)
        : Promise.reject(new Error('team id is required')),
    enabled: Boolean(id),
    staleTime: COLLECTION_STALE_TIME,
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear()
      toast(i18n.t('toasts.logoutSuccess'))
    },
    onError: () => toast.error(i18n.t('toasts.logoutError')),
  })
}

export function useDeleteMe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.deleteMe,
    onSuccess: () => {
      queryClient.clear()
      toast.success(i18n.t('toasts.userDeleted'))
    },
    onError: (error) => notifyMutationError(error, i18n.t('toasts.userDeleteError')),
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAccountRequest) => api.createAccount(body),
    onSuccess: (account) => {
      queryClient.setQueryData<MeResponse>(queryKeys.me, (current) =>
        current
          ? {
              ...current,
              accounts: [account, ...current.accounts.filter(({ id }) => id !== account.id)],
            }
          : current,
      )
      toast.success(i18n.t('toasts.accountLinked', { uid: account.uid }))
    },
    onError: (error) => notifyMutationError(error, i18n.t('toasts.accountLinkError')),
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteAccount(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<MeResponse>(queryKeys.me, (current) =>
        current
          ? { ...current, accounts: current.accounts.filter((account) => account.id !== id) }
          : current,
      )
      // Scope to the deleted account. The bare ['builds'] / ['teams'] prefixes
      // also match the user's other game accounts, whose data is untouched.
      void queryClient.invalidateQueries({ queryKey: ['builds', id] })
      void queryClient.invalidateQueries({ queryKey: ['teams', id] })
      toast.success(i18n.t('toasts.accountDeleted'))
    },
    onError: (error) => notifyMutationError(error, i18n.t('toasts.accountDeleteError')),
  })
}

export function useSaveBuild() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateBuildRequest) => api.createBuild(body),
    onSuccess: (build, variables) => {
      const langKey = currentLangKey()
      queryClient.setQueryData<Build[]>(
        queryKeys.builds(variables.game_account_id, langKey),
        (current) =>
          current
            ? [build, ...current.filter(({ id }) => id !== build.id)]
            : current,
      )
      toast.success(i18n.t('toasts.buildSaved', { name: build.name }))
    },
    onError: (error) => notifyMutationError(error, i18n.t('toasts.buildSaveError')),
  })
}

export function useRenameBuild() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      name,
      description,
    }: {
      id: string
      gameAccountId: string
      name: string
      description?: string | null
    }) => api.renameBuild(id, name, description),
    onSuccess: (_data, variables) => {
      // Invalidate exactly the list that can contain this build. A bare
      // ['builds'] prefix also matches every other account and every other
      // language variant, so each active observer would refetch.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.builds(variables.gameAccountId, currentLangKey()),
        exact: true,
      })
      toast.success(i18n.t('toasts.buildUpdated', { name: variables.name }))
    },
    onError: (error) => notifyMutationError(error, i18n.t('toasts.buildUpdateError')),
  })
}

export function useToggleBuildVisibility() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      isPublic,
    }: {
      id: string
      gameAccountId: string
      isPublic: boolean
    }) => api.updateBuild(id, { is_public: isPublic }),
    onMutate: async ({ id, gameAccountId, isPublic }) => {
      const langKey = currentLangKey()
      const queryKey = queryKeys.builds(gameAccountId, langKey)
      await queryClient.cancelQueries({ queryKey, exact: true })
      const previousBuilds = queryClient.getQueryData<Build[]>(queryKey)

      if (previousBuilds) {
        queryClient.setQueryData<Build[]>(
          queryKey,
          previousBuilds.map((b) => (b.id === id ? { ...b, is_public: isPublic } : b)),
        )
      }
      return { previousBuilds, queryKey }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousBuilds) {
        queryClient.setQueryData(context.queryKey, context.previousBuilds)
      }
      toast.error(i18n.t('toasts.visibilityUpdateError'))
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.builds(variables.gameAccountId, currentLangKey()),
        exact: true,
      })
    },
  })
}

export function useDeleteBuild() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; gameAccountId: string }) => api.deleteBuild(id),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.builds(variables.gameAccountId, currentLangKey()),
        exact: true,
      })
      toast.success(i18n.t('toasts.buildDeleted'))
    },
    onError: (error) => {
      if (error instanceof api.ApiError && error.status === 409) {
        toast.error(i18n.t('toasts.buildInUseError'))
        return
      }
      notifyMutationError(error, i18n.t('toasts.buildDeleteError'))
    },
  })
}

export function useTeamValidationQuery(buildIds: string[]) {
  const currentKey = Array.from(new Set(buildIds.filter(Boolean))).sort().join(',')
  const debouncedBuildIds = useDebouncedValue(buildIds, VALIDATION_DEBOUNCE_MS)
  const debouncedKey = Array.from(new Set(debouncedBuildIds.filter(Boolean))).sort().join(',')
  const isSettling = currentKey !== debouncedKey

  const query = useQuery({
    queryKey: queryKeys.teamValidation(debouncedKey),
    queryFn: ({ signal }) => api.validateTeam(debouncedKey ? debouncedKey.split(',') : [], signal),
    enabled: debouncedKey.length > 0,
    staleTime: COLLECTION_STALE_TIME,
  })

  return {
    ...query,
    data: isSettling ? undefined : query.data,
    isFetching: query.isFetching || isSettling,
    isPending: query.isPending || isSettling,
  }
}

export function useSaveTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateTeamRequest) => api.createTeam(body),
    onSuccess: (team, variables) => {
      const langKey = currentLangKey()
      void queryClient.invalidateQueries({
        queryKey: queryKeys.teams(variables.game_account_id, langKey),
        exact: true,
      })
      // The builder gates its save button on this count.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.teamCount(variables.game_account_id),
        exact: true,
      })
      toast.success(i18n.t('toasts.teamSaved', { name: team.name }))
    },
    onError: (error) => {
      if (error instanceof api.ApiError && error.conflicts) return
      notifyMutationError(error, i18n.t('toasts.teamSaveError'))
    },
  })
}

export function useUpdateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateTeamRequest) => api.updateTeam(body),
    onSuccess: (team, variables) => {
      const langKey = currentLangKey()
      void queryClient.invalidateQueries({
        queryKey: queryKeys.teams(variables.game_account_id, langKey),
        exact: true,
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.team(variables.id, langKey),
        exact: true,
      })
      toast.success(i18n.t('toasts.teamUpdated', { name: team.name }))
    },
    onError: (error) => {
      if (error instanceof api.ApiError && error.conflicts) return
      notifyMutationError(error, i18n.t('toasts.teamUpdateError'))
    },
  })
}

export function useDeleteTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; gameAccountId: string }) => api.deleteTeam(id),
    onSuccess: (_data, variables) => {
      const langKey = currentLangKey()
      void queryClient.invalidateQueries({
        queryKey: queryKeys.teams(variables.gameAccountId, langKey),
        exact: true,
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.teamCount(variables.gameAccountId),
        exact: true,
      })
      // Drop the detail entry outright: an invalidated key would keep the
      // deleted team renderable in the editor until its next refetch.
      queryClient.removeQueries({ queryKey: queryKeys.team(variables.id, langKey), exact: true })
      toast.success(i18n.t('toasts.teamDeleted'))
    },
    onError: (error) => notifyMutationError(error, i18n.t('toasts.teamDeleteError')),
  })
}

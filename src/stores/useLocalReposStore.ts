import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LocalRepo {
  id: string
  path: string
  name: string
  addedAt: string
}

interface LocalReposState {
  repos: LocalRepo[]
  selectedRepoId: string | null
  addRepo: (path: string, name: string) => void
  removeRepo: (id: string) => void
  selectRepo: (id: string | null) => void
  getSelectedRepo: () => LocalRepo | null
}

export const useLocalReposStore = create<LocalReposState>()(
  persist(
    (set, get) => ({
      repos: [],
      selectedRepoId: null,

      addRepo: (path: string, name: string) => {
        const existing = get().repos.find((r) => r.path === path)
        if (existing) {
          set({ selectedRepoId: existing.id })
          return
        }

        const newRepo: LocalRepo = {
          id: crypto.randomUUID(),
          path,
          name,
          addedAt: new Date().toISOString(),
        }

        set((state) => ({
          repos: [...state.repos, newRepo],
          selectedRepoId: newRepo.id,
        }))
      },

      removeRepo: (id: string) => {
        set((state) => ({
          repos: state.repos.filter((r) => r.id !== id),
          selectedRepoId: state.selectedRepoId === id ? null : state.selectedRepoId,
        }))
      },

      selectRepo: (id: string | null) => {
        set({ selectedRepoId: id })
      },

      getSelectedRepo: () => {
        const state = get()
        return state.repos.find((r) => r.id === state.selectedRepoId) || null
      },
    }),
    {
      name: 'git-manager-local-repos',
    }
  )
)

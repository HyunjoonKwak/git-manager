import { invoke } from '@tauri-apps/api/core'

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  clone_url: string
  ssh_url: string
  private: boolean
  fork: boolean
  stargazers_count: number
  watchers_count: number
  forks_count: number
  language: string | null
  default_branch: string
  updated_at: string
  pushed_at: string | null
}

export interface GitHubUser {
  login: string
  id: number
  avatar_url: string
  html_url: string
  name: string | null
  bio: string | null
  public_repos: number
  followers: number
  following: number
}

// 토큰 관리
export async function saveGitHubToken(token: string): Promise<void> {
  return invoke('save_github_token', { token })
}

export async function getGitHubToken(): Promise<string | null> {
  return invoke('get_github_token')
}

export async function deleteGitHubToken(): Promise<void> {
  return invoke('delete_github_token')
}

// GitHub API
export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  return invoke('fetch_github_user', { token })
}

export async function fetchGitHubRepos(token: string): Promise<GitHubRepo[]> {
  return invoke('fetch_github_repos', { token })
}

// 즐겨찾기
export async function getGitHubFavorites(): Promise<number[]> {
  return invoke('get_github_favorites')
}

export async function addGitHubFavorite(repoId: number): Promise<void> {
  return invoke('add_github_favorite', { repo_id: repoId })
}

export async function removeGitHubFavorite(repoId: number): Promise<void> {
  return invoke('remove_github_favorite', { repo_id: repoId })
}

// 저장소 생성
export async function createGitHubRepo(
  token: string,
  name: string,
  description: string | null,
  isPrivate: boolean
): Promise<GitHubRepo> {
  return invoke('create_github_repo', {
    token,
    name,
    description,
    private: isPrivate,
  })
}

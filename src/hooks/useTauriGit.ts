import { invoke } from '@tauri-apps/api/core'

export interface RepoInfo {
  path: string
  name: string
  current_branch: string
  branches: BranchInfo[]
  status: FileStatus[]
  remotes: string[]
  last_commit: CommitInfo | null
}

export interface BranchInfo {
  name: string
  current: boolean
  commit: string
}

export interface FileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
}

export interface CommitInfo {
  hash: string
  hash_short: string
  message: string
  author: string
  email: string
  date: string
}

export interface GraphCommit {
  hash: string
  hash_short: string
  message: string
  author: string
  email: string
  date: string
  parents: string[]
  branches: string[]
  tags: string[]
  column: number
  color: number
}

export interface RemoteStatus {
  ahead: number
  behind: number
  has_remote: boolean
  remote: string | null
}

// Convert snake_case from Rust to camelCase for frontend
function convertRepoInfo(data: any): RepoInfo {
  return {
    path: data.path,
    name: data.name,
    current_branch: data.current_branch,
    branches: data.branches,
    status: data.status,
    remotes: data.remotes,
    last_commit: data.last_commit ? {
      hash: data.last_commit.hash,
      hash_short: data.last_commit.hash_short,
      message: data.last_commit.message,
      author: data.last_commit.author,
      email: data.last_commit.email,
      date: data.last_commit.date,
    } : null,
  }
}

export async function getRepoInfo(path: string): Promise<RepoInfo> {
  const data = await invoke<any>('get_repo_info', { path })
  return convertRepoInfo(data)
}

export async function getStatus(path: string): Promise<FileStatus[]> {
  return invoke<FileStatus[]>('get_status', { path })
}

export async function stageFile(path: string, filePath: string): Promise<void> {
  return invoke('stage_file', { path, filePath })
}

export async function unstageFile(path: string, filePath: string): Promise<void> {
  return invoke('unstage_file', { path, filePath })
}

export async function stageAll(path: string): Promise<void> {
  return invoke('stage_all', { path })
}

export async function commit(path: string, message: string): Promise<string> {
  return invoke<string>('commit', { path, message })
}

export async function push(path: string): Promise<void> {
  return invoke('push', { path })
}

export async function pushToRemote(path: string, remote: string, branch: string): Promise<void> {
  return invoke('push_to_remote', { path, remote, branch })
}

export async function pull(path: string): Promise<void> {
  return invoke('pull', { path })
}

export async function fetchRemote(path: string): Promise<void> {
  return invoke('fetch_remote', { path })
}

export async function getBranches(path: string): Promise<BranchInfo[]> {
  return invoke<BranchInfo[]>('get_branches', { path })
}

export async function checkoutBranch(path: string, branchName: string): Promise<void> {
  return invoke('checkout_branch', { path, branchName })
}

export async function getLog(path: string, maxCount: number): Promise<CommitInfo[]> {
  return invoke<CommitInfo[]>('get_log', { path, maxCount })
}

export async function getGraphLog(path: string, maxCount: number): Promise<GraphCommit[]> {
  return invoke<GraphCommit[]>('get_graph_log', { path, maxCount })
}

export async function getDiff(path: string, filePath?: string): Promise<string> {
  return invoke<string>('get_diff', { path, filePath })
}

export async function getStagedDiff(path: string): Promise<string> {
  return invoke<string>('get_staged_diff', { path })
}

export async function getCommitDiff(path: string, commitHash: string): Promise<string> {
  return invoke<string>('get_commit_diff', { path, commitHash })
}

export async function discardChanges(path: string, filePath: string): Promise<void> {
  return invoke('discard_changes', { path, filePath })
}

export async function getRemoteStatus(path: string): Promise<RemoteStatus> {
  return invoke<RemoteStatus>('get_remote_status', { path })
}

export async function watchRepo(path: string): Promise<void> {
  return invoke('watch_repo', { path })
}

export async function unwatchRepo(path: string): Promise<void> {
  return invoke('unwatch_repo', { path })
}

export async function unwatchAll(): Promise<void> {
  return invoke('unwatch_all')
}

// ============ 원격 저장소 관리 ============

export interface RemoteInfo {
  name: string
  fetch_url: string
  push_url: string
}

export interface RemoteBranchInfo {
  name: string
  remote: string
  commit: string
  is_tracking: boolean
}

export async function getRemotes(path: string): Promise<RemoteInfo[]> {
  return invoke<RemoteInfo[]>('get_remotes', { path })
}

export async function addRemote(path: string, name: string, url: string): Promise<void> {
  return invoke('add_remote', { path, name, url })
}

export async function removeRemote(path: string, name: string): Promise<void> {
  return invoke('remove_remote', { path, name })
}

export async function setRemoteUrl(path: string, name: string, url: string): Promise<void> {
  return invoke('set_remote_url', { path, name, url })
}

export async function renameRemote(path: string, oldName: string, newName: string): Promise<void> {
  return invoke('rename_remote', { path, oldName, newName })
}

export async function getRemoteBranches(path: string): Promise<RemoteBranchInfo[]> {
  return invoke<RemoteBranchInfo[]>('get_remote_branches', { path })
}

export async function checkoutRemoteBranch(path: string, remoteBranch: string, localName: string): Promise<void> {
  return invoke('checkout_remote_branch', { path, remoteBranch, localName })
}

export async function deleteRemoteBranch(path: string, remote: string, branch: string): Promise<void> {
  return invoke('delete_remote_branch', { path, remote, branch })
}

export async function pruneRemote(path: string, remote: string): Promise<void> {
  return invoke('prune_remote', { path, remote })
}

export async function fetchFromRemote(path: string, remote: string): Promise<void> {
  return invoke('fetch_from_remote', { path, remote })
}

// ============ AI 커밋 메시지 생성 ============

export interface AiConfig {
  provider: 'ollama' | 'openai' | 'anthropic'
  ollama_url: string
  ollama_model: string
  openai_key: string
  openai_model: string
  anthropic_key: string
  anthropic_model: string
}

export async function getAiConfig(): Promise<AiConfig> {
  return invoke<AiConfig>('get_ai_config')
}

export async function saveAiConfig(config: AiConfig): Promise<void> {
  return invoke('save_ai_config', { config })
}

export async function generateCommitMessage(path: string): Promise<string> {
  return invoke<string>('generate_commit_message', { path })
}

// ============ 저장소 초기화 및 복제 ============

export async function initRepo(path: string): Promise<string> {
  return invoke<string>('init_repo', { path })
}

export async function cloneRepo(url: string, path: string): Promise<void> {
  return invoke('clone_repo', { url, path })
}

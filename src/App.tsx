import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocalReposStore } from './stores/useLocalReposStore'
import {
  getRepoInfo,
  fetchRemote,
  push,
  pull,
  watchRepo,
  unwatchRepo,
  initRepo,
  cloneRepo,
  type RepoInfo,
} from './hooks/useTauriGit'
import {
  QuickStatus,
  BranchGraph,
  FileStatusView,
  InlineCommit,
  GitActionButton,
  StashList,
  AiSettings,
  RemoteSidebar,
  GitHubSidebar,
  GitHubReposView,
  PublishToGitHub,
} from './components/local'
import type { GitHubRepo } from './hooks/useGitHub'
import { Toaster } from './components/ui/sonner'
import { toast } from 'sonner'
import { Button } from './components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Loader2, FolderOpen, Plus, Trash2, GitBranch, Sun, Moon, Download, FolderPlus } from 'lucide-react'
import { useTheme } from './hooks/useTheme'
import { open } from '@tauri-apps/plugin-dialog'
import { listen } from '@tauri-apps/api/event'
import { cn } from './lib/utils'

function App() {
  const { repos, selectedRepoId, addRepo, removeRepo, selectRepo } = useLocalReposStore()
  const selectedRepo = useMemo(() => repos.find(r => r.id === selectedRepoId) || null, [repos, selectedRepoId])
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const { theme, toggleTheme } = useTheme()

  // Clone 다이얼로그 상태
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false)
  const [cloneUrl, setCloneUrl] = useState('')
  const [cloneLoading, setCloneLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(false)

  // GitHub 뷰 상태
  const [githubViewMode, setGithubViewMode] = useState<'all' | 'favorites' | null>(null)
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([])

  const handleViewGitHubRepos = (repos: GitHubRepo[], mode: 'all' | 'favorites') => {
    setGithubRepos(repos)
    setGithubViewMode(mode)
  }

  const closeGitHubView = () => {
    setGithubViewMode(null)
    setGithubRepos([])
  }

  const handleAddRepo = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '저장소 폴더 선택',
      })

      if (selected && typeof selected === 'string') {
        const name = selected.split('/').pop() || 'unknown'
        addRepo(selected, name)
        toast.success('저장소가 추가되었습니다')
      }
    } catch (err) {
      toast.error('폴더 선택에 실패했습니다')
    }
  }

  const handleInitRepo = async () => {
    if (initLoading) return // 중복 실행 방지
    setInitLoading(true)

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '초기화할 폴더 선택',
      })

      if (selected && typeof selected === 'string') {
        // 먼저 init 실행
        await initRepo(selected)

        // 이미 목록에 있는지 확인
        const existing = repos.find((r) => r.path === selected)
        if (existing) {
          // 이미 있으면 선택만 하고 새로고침
          selectRepo(existing.id)
          // 약간의 딜레이 후 새로고침 (상태 업데이트 대기)
          setTimeout(() => fetchRepoInfo(), 100)
        } else {
          // 없으면 추가 (addRepo 후 자동으로 선택되어 fetchRepoInfo 호출됨)
          const name = selected.split('/').pop() || 'unknown'
          addRepo(selected, name)
        }
        toast.success('Git 저장소가 초기화되었습니다')
      }
    } catch (err) {
      toast.error(`초기화 실패: ${err}`)
    } finally {
      setInitLoading(false)
    }
  }

  const handleCloneRepo = async () => {
    if (!cloneUrl.trim()) {
      toast.error('URL을 입력해주세요')
      return
    }

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Clone할 위치 선택',
      })

      if (selected && typeof selected === 'string') {
        // URL에서 저장소 이름 추출
        const repoName = cloneUrl.split('/').pop()?.replace('.git', '') || 'cloned-repo'
        const targetPath = `${selected}/${repoName}`

        setCloneLoading(true)
        await cloneRepo(cloneUrl, targetPath)
        addRepo(targetPath, repoName)
        setCloneDialogOpen(false)
        setCloneUrl('')
        toast.success('저장소가 복제되었습니다')
      }
    } catch (err) {
      toast.error(`Clone 실패: ${err}`)
    } finally {
      setCloneLoading(false)
    }
  }

  const fetchRepoInfo = useCallback(async () => {
    if (!selectedRepo) {
      setRepoInfo(null)
      return
    }

    setLoading(true)
    try {
      const info = await getRepoInfo(selectedRepo.path)
      setRepoInfo(info)
    } catch (err) {
      toast.error('저장소 정보를 가져오지 못했습니다')
      setRepoInfo(null)
    } finally {
      setLoading(false)
    }
  }, [selectedRepo])

  useEffect(() => {
    fetchRepoInfo()

    if (selectedRepo) {
      watchRepo(selectedRepo.path).catch(console.error)
    }

    return () => {
      if (selectedRepo) {
        unwatchRepo(selectedRepo.path).catch(console.error)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepoId])

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const unlisten = listen('git-changed', () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        fetchRepoInfo()
      }, 300)
    })

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      unlisten.then(fn => fn())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepoId])

  const handleGitAction = async (action: string) => {
    if (!selectedRepo) return
    setActionLoading(action)
    try {
      switch (action) {
        case 'fetch':
          await fetchRemote(selectedRepo.path)
          break
        case 'pull':
          await pull(selectedRepo.path)
          break
        case 'push':
          await push(selectedRepo.path)
          break
      }

      const actionLabels: Record<string, string> = {
        fetch: 'Fetch',
        pull: 'Pull',
        push: 'Push',
      }
      toast.success(`${actionLabels[action] || action} 완료`)
      fetchRepoInfo()
    } catch {
      toast.error(`${action}에 실패했습니다`)
    } finally {
      setActionLoading(null)
    }
  }

  const stagedCount = repoInfo?.status.filter((f) => f.staged).length || 0

  return (
    <div className="flex h-screen bg-background">
      {/* 사이드바 */}
      <div className="w-72 border-r bg-muted/30 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-lg">Git Manager</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleTheme}
              title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <AiSettings />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleAddRepo}>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  기존 저장소 열기
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleInitRepo}>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  새 저장소 초기화 (Init)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCloneDialogOpen(true)}>
                  <Download className="w-4 h-4 mr-2" />
                  원격 저장소 복제 (Clone)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 저장소 목록 */}
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground font-medium mb-2">저장소</p>
          <div className="space-y-1">
            {repos.map(repo => (
              <div
                key={repo.id}
                className={cn(
                  'group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors',
                  selectedRepoId === repo.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted'
                )}
                onClick={() => selectRepo(repo.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen className={cn('w-4 h-4 flex-shrink-0', selectedRepoId === repo.id ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="truncate text-sm font-medium">{repo.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={e => { e.stopPropagation(); removeRepo(repo.id) }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {repos.length === 0 && (
              <div className="text-center py-4">
                <FolderOpen className="w-8 h-8 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">저장소를 추가하세요</p>
              </div>
            )}
          </div>
        </div>

        {/* Stash (선택된 저장소가 있을 때만) */}
        {selectedRepo && (
          <div className="flex-1 overflow-auto border-t p-2">
            <StashList repoPath={selectedRepo.path} onRefresh={fetchRepoInfo} />
          </div>
        )}

        {/* GitHub 섹션 */}
        <div className="border-t">
          <GitHubSidebar onViewRepos={handleViewGitHubRepos} />
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* GitHub 뷰 */}
        {githubViewMode ? (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={closeGitHubView}>
                ← 돌아가기
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <GitHubReposView repos={githubRepos} mode={githubViewMode} />
            </div>
          </div>
        ) : !selectedRepo ? (
          <div className="flex items-center justify-center flex-1 m-6">
            <div className="text-center max-w-md">
              <GitBranch className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Git Manager</h2>
              <p className="text-muted-foreground mb-6">
                로컬 Git 저장소를 관리하고 GitHub와 연동하세요
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={handleAddRepo} className="w-full">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  기존 저장소 열기
                </Button>
                <Button variant="outline" onClick={handleInitRepo} className="w-full">
                  <FolderPlus className="w-4 h-4 mr-2" />
                  새 저장소 초기화
                </Button>
                <Button variant="outline" onClick={() => setCloneDialogOpen(true)} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  원격 저장소 복제
                </Button>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center flex-1 border rounded-lg m-6">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : repoInfo ? (
          <>
            {/* Quick Status + 원격 저장소 (상단 고정) */}
            <div className="p-4 pb-0">
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <QuickStatus
                    repoPath={selectedRepo.path}
                    repoName={repoInfo.name}
                    currentBranch={repoInfo.current_branch}
                    branches={repoInfo.branches}
                    files={repoInfo.status}
                    lastCommit={repoInfo.last_commit}
                    onRefresh={fetchRepoInfo}
                    onBranchChange={fetchRepoInfo}
                  />
                </div>
                <div className="w-64">
                  <RemoteSidebar repoPath={selectedRepo.path} onRefresh={fetchRepoInfo} compact />
                </div>
              </div>
            </div>

            {/* 빠른 액션 버튼 */}
            <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
              <GitActionButton
                actionId="fetch"
                onClick={() => handleGitAction('fetch')}
                loading={actionLoading === 'fetch'}
                disabled={actionLoading !== null}
              />
              <GitActionButton
                actionId="pull"
                onClick={() => handleGitAction('pull')}
                loading={actionLoading === 'pull'}
                disabled={actionLoading !== null}
              />
              <GitActionButton
                actionId="push"
                onClick={() => handleGitAction('push')}
                loading={actionLoading === 'push'}
                disabled={actionLoading !== null}
              />
              <div className="h-4 w-px bg-border mx-1" />
              <PublishToGitHub
                repoPath={selectedRepo.path}
                repoName={repoInfo.name}
                onSuccess={fetchRepoInfo}
              />
            </div>

            {/* 메인 콘텐츠 - 그래프(왼쪽) + 파일(오른쪽) 병렬 레이아웃 */}
            <div className="flex-1 overflow-hidden px-4 pb-2">
              <div className="grid grid-cols-2 gap-4 h-full">
                {/* 왼쪽: 브랜치 그래프 */}
                <div className="overflow-auto">
                  <BranchGraph repoPath={selectedRepo.path} />
                </div>

                {/* 오른쪽: 파일 상태 */}
                <div className="overflow-auto">
                  <FileStatusView
                    repoPath={selectedRepo.path}
                    files={repoInfo.status}
                    onRefresh={fetchRepoInfo}
                  />
                </div>
              </div>
            </div>

            {/* 인라인 커밋 (하단 고정) */}
            <div className="p-4 pt-2">
              <InlineCommit
                repoPath={selectedRepo.path}
                stagedCount={stagedCount}
                onCommit={fetchRepoInfo}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 border rounded-lg m-6">
            <p className="text-muted-foreground">저장소 정보를 가져오지 못했습니다</p>
          </div>
        )}
      </div>

      {/* Clone 다이얼로그 */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>원격 저장소 복제</DialogTitle>
            <DialogDescription>
              GitHub, GitLab 등의 저장소 URL을 입력하세요
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="clone-url">저장소 URL</Label>
              <Input
                id="clone-url"
                placeholder="https://github.com/user/repo.git"
                value={cloneUrl}
                onChange={(e) => setCloneUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCloneRepo()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCloneRepo} disabled={cloneLoading}>
              {cloneLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Clone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  )
}

export default App

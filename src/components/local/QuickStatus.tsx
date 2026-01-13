import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  GitBranch,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Circle,
  Check,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getRemoteStatus, checkoutBranch, type RemoteStatus, type FileStatus, type BranchInfo, type CommitInfo } from '@/hooks/useTauriGit'

interface QuickStatusProps {
  repoPath: string
  repoName: string
  currentBranch: string
  branches: BranchInfo[]
  files: FileStatus[]
  lastCommit: CommitInfo | null
  onRefresh: () => void
  onBranchChange?: () => void
}

export function QuickStatus({
  repoPath,
  repoName,
  currentBranch,
  branches,
  files,
  lastCommit,
  onRefresh,
  onBranchChange,
}: QuickStatusProps) {
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const stagedCount = files.filter((f) => f.staged).length
  const modifiedCount = files.filter((f) => !f.staged && f.status === 'modified').length
  const untrackedCount = files.filter((f) => f.status === 'untracked').length
  const addedCount = files.filter((f) => !f.staged && f.status === 'added').length
  const deletedCount = files.filter((f) => !f.staged && f.status === 'deleted').length

  const fetchRemoteStatusData = async () => {
    try {
      const data = await getRemoteStatus(repoPath)
      setRemoteStatus(data)
    } catch {
      // 원격 상태 가져오기 실패
    }
  }

  useEffect(() => {
    fetchRemoteStatusData()
  }, [repoPath, currentBranch])

  const handleRefresh = async () => {
    setLoading(true)
    await fetchRemoteStatusData()
    onRefresh()
    setLoading(false)
  }

  const handleBranchChange = async (branchName: string) => {
    if (branchName === currentBranch) return

    setCheckoutLoading(true)
    try {
      await checkoutBranch(repoPath, branchName)
      toast.success(`${branchName} 브랜치로 전환했습니다`)
      onBranchChange?.()
      onRefresh()
    } catch {
      toast.error('브랜치 전환에 실패했습니다')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <Card className="p-2">
      <div className="flex items-center gap-4">
        {/* 저장소 이름 & 브랜치 */}
        <div className="flex items-center gap-2 min-w-[160px]">
          <div>
            <h2 className="font-semibold text-sm">{repoName}</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 -ml-2 text-muted-foreground hover:text-foreground"
                  disabled={checkoutLoading}
                >
                  <GitBranch className="w-4 h-4 mr-1" />
                  <span className="font-medium">{currentBranch}</span>
                  {checkoutLoading ? (
                    <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                  ) : (
                    <ChevronDown className="w-3 h-3 ml-1" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {branches.map((branch) => (
                  <DropdownMenuItem
                    key={branch.name}
                    onClick={() => handleBranchChange(branch.name)}
                    className="cursor-pointer"
                  >
                    {branch.current ? (
                      <Check className="w-4 h-4 mr-2 text-green-500" />
                    ) : (
                      <div className="w-4 h-4 mr-2" />
                    )}
                    <span className="truncate">{branch.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 구분선 */}
        <div className="h-6 w-px bg-border" />

        {/* 파일 상태 요약 */}
        <div className="flex items-center gap-1.5">
          {stagedCount > 0 && (
            <Badge variant="default" className="gap-0.5 text-[10px] px-1.5 py-0 h-5">
              <Circle className="w-2.5 h-2.5 fill-current" />
              {stagedCount}
            </Badge>
          )}
          {modifiedCount > 0 && (
            <Badge variant="secondary" className="gap-0.5 text-[10px] px-1.5 py-0 h-5 bg-yellow-500/10 text-yellow-600">
              ~{modifiedCount}
            </Badge>
          )}
          {addedCount > 0 && (
            <Badge variant="secondary" className="gap-0.5 text-[10px] px-1.5 py-0 h-5 bg-green-500/10 text-green-600">
              +{addedCount}
            </Badge>
          )}
          {deletedCount > 0 && (
            <Badge variant="secondary" className="gap-0.5 text-[10px] px-1.5 py-0 h-5 bg-red-500/10 text-red-600">
              -{deletedCount}
            </Badge>
          )}
          {untrackedCount > 0 && (
            <Badge variant="outline" className="gap-0.5 text-[10px] px-1.5 py-0 h-5">
              ?{untrackedCount}
            </Badge>
          )}
          {files.length === 0 && (
            <span className="text-[10px] text-muted-foreground">Clean</span>
          )}
        </div>

        {/* 구분선 */}
        <div className="h-6 w-px bg-border" />

        {/* 원격 상태 */}
        <div className="flex items-center gap-1">
          {remoteStatus?.has_remote ? (
            <>
              {remoteStatus.ahead > 0 && (
                <Badge variant="outline" className="gap-0.5 text-[10px] px-1 py-0 h-5 bg-blue-500/10 text-blue-600">
                  <ArrowUp className="w-2.5 h-2.5" />
                  {remoteStatus.ahead}
                </Badge>
              )}
              {remoteStatus.behind > 0 && (
                <Badge variant="outline" className="gap-0.5 text-[10px] px-1 py-0 h-5 bg-orange-500/10 text-orange-600">
                  <ArrowDown className="w-2.5 h-2.5" />
                  {remoteStatus.behind}
                </Badge>
              )}
              {remoteStatus.ahead === 0 && remoteStatus.behind === 0 && (
                <Check className="w-3 h-3 text-green-500" />
              )}
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground">No remote</span>
          )}
        </div>

        {/* 구분선 */}
        <div className="h-6 w-px bg-border" />

        {/* 최근 커밋 */}
        <div className="flex-1 min-w-0">
          {lastCommit ? (
            <div className="flex items-center gap-1.5">
              <code className="px-1 py-0 rounded bg-muted text-[10px] font-mono">
                {lastCommit.hash_short}
              </code>
              <span className="truncate text-[11px] text-muted-foreground max-w-[150px]">
                {lastCommit.message}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground">No commits</span>
          )}
        </div>

        {/* 새로고침 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={loading}
          className="h-6 w-6 flex-shrink-0"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
        </Button>
      </div>
    </Card>
  )
}

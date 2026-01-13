import { useState, useEffect, useMemo, ReactElement } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Monitor,
  Cloud,
  ChevronDown,
  ChevronRight,
  Copy,
  GitBranch,
  RotateCcw,
  Tag,
  ExternalLink,
  CherryIcon,
  Undo2,
  Archive,
  GitMerge,
  Trash2,
  Edit,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getGraphLog, getCommitDiff, type GraphCommit } from '@/hooks/useTauriGit'
import { invoke } from '@tauri-apps/api/core'

interface BranchGraphProps {
  repoPath: string
  onRefresh?: () => void
}

const COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]

const NODE_RADIUS = 4
const ROW_HEIGHT = 24
const COLUMN_WIDTH = 16
const GRAPH_PADDING = 6

export function BranchGraph({ repoPath, onRefresh }: BranchGraphProps) {
  const [commits, setCommits] = useState<GraphCommit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [commitDiff, setCommitDiff] = useState<string>('')
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffExpanded, setDiffExpanded] = useState(true)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  // Context menu handlers
  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
    toast.success('커밋 해시 복사됨')
  }

  const handleCheckout = async (hash: string) => {
    try {
      await invoke('checkout_commit', { path: repoPath, commitHash: hash })
      toast.success('체크아웃 완료')
      fetchGraph()
      onRefresh?.()
    } catch {
      toast.error('체크아웃 실패')
    }
  }

  const handleCreateBranch = async (hash: string) => {
    const branchName = prompt('새 브랜치 이름:')
    if (!branchName?.trim()) return

    try {
      await invoke('create_branch_at', { path: repoPath, branchName: branchName.trim(), commitHash: hash })
      toast.success(`${branchName} 브랜치 생성됨`)
      fetchGraph()
      onRefresh?.()
    } catch {
      toast.error('브랜치 생성 실패')
    }
  }

  const handleResetTo = async (hash: string, mode: 'soft' | 'mixed' | 'hard') => {
    if (mode === 'hard') {
      if (!confirm('Hard reset은 모든 변경사항을 삭제합니다. 계속하시겠습니까?')) return
    }

    try {
      await invoke('reset_to_commit', { path: repoPath, commitHash: hash, mode })
      toast.success(`Reset (${mode}) 완료`)
      fetchGraph()
      onRefresh?.()
    } catch {
      toast.error('Reset 실패')
    }
  }

  const handleCreateTag = async (hash: string) => {
    const tagName = prompt('태그 이름:')
    if (!tagName?.trim()) return

    try {
      await invoke('create_tag', { path: repoPath, tagName: tagName.trim(), commitHash: hash })
      toast.success(`${tagName} 태그 생성됨`)
      fetchGraph()
    } catch {
      toast.error('태그 생성 실패')
    }
  }

  const handleCherryPick = async (hash: string) => {
    try {
      await invoke('cherry_pick', { path: repoPath, commitHash: hash })
      toast.success('Cherry-pick 완료')
      fetchGraph()
      onRefresh?.()
    } catch {
      toast.error('Cherry-pick 실패')
    }
  }

  const handleRevert = async (hash: string) => {
    try {
      await invoke('revert_commit', { path: repoPath, commitHash: hash })
      toast.success('Revert 완료')
      fetchGraph()
      onRefresh?.()
    } catch {
      toast.error('Revert 실패')
    }
  }

  const handleStashSave = async () => {
    const message = prompt('Stash 메시지 (선택):')
    try {
      await invoke('stash_save', { path: repoPath, message: message || null })
      toast.success('Stash 저장됨')
      onRefresh?.()
    } catch {
      toast.error('Stash 실패')
    }
  }

  const handleStashPop = async () => {
    try {
      await invoke('stash_pop', { path: repoPath })
      toast.success('Stash 적용됨')
      fetchGraph()
      onRefresh?.()
    } catch {
      toast.error('Stash pop 실패')
    }
  }

  const handleMergeBranch = async (branchName: string) => {
    try {
      await invoke('merge_branch', { path: repoPath, branchName })
      toast.success(`${branchName} 병합 완료`)
      fetchGraph()
      onRefresh?.()
    } catch {
      toast.error('병합 실패')
    }
  }

  const handleRebase = async (branchName: string) => {
    try {
      await invoke('rebase_onto', { path: repoPath, branchName })
      toast.success(`${branchName}로 리베이스 완료`)
      fetchGraph()
      onRefresh?.()
    } catch {
      toast.error('리베이스 실패')
    }
  }

  const handleDeleteBranch = async (branchName: string, force: boolean = false) => {
    if (!confirm(`${branchName} 브랜치를 삭제하시겠습니까?`)) return
    try {
      await invoke('delete_branch', { path: repoPath, branchName, force })
      toast.success(`${branchName} 삭제됨`)
      fetchGraph()
      onRefresh?.()
    } catch {
      toast.error('브랜치 삭제 실패')
    }
  }

  const handleRenameBranch = async (oldName: string) => {
    const newName = prompt('새 브랜치 이름:', oldName)
    if (!newName?.trim() || newName === oldName) return
    try {
      await invoke('rename_branch', { path: repoPath, oldName, newName: newName.trim() })
      toast.success(`${oldName} → ${newName}`)
      fetchGraph()
      onRefresh?.()
    } catch {
      toast.error('브랜치 이름 변경 실패')
    }
  }

  const fetchGraph = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getGraphLog(repoPath, 50)
      setCommits(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGraph()
  }, [repoPath])

  // Fetch diff when commit is selected
  useEffect(() => {
    if (selectedCommit) {
      setDiffLoading(true)
      setCommitDiff('')
      setExpandedFiles(new Set())
      getCommitDiff(repoPath, selectedCommit)
        .then((diff) => setCommitDiff(diff))
        .catch(() => setCommitDiff(''))
        .finally(() => setDiffLoading(false))
    } else {
      setCommitDiff('')
      setExpandedFiles(new Set())
    }
  }, [selectedCommit, repoPath])

  // Parse diff into file sections
  const parseDiffByFile = (diff: string) => {
    const files: { name: string; stats: string; lines: string[] }[] = []
    const lines = diff.split('\n')
    let currentFile: { name: string; stats: string; lines: string[] } | null = null

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        // New file section
        if (currentFile) {
          files.push(currentFile)
        }
        // Extract filename from "diff --git a/path b/path"
        const match = line.match(/diff --git a\/(.*) b\/(.*)/)
        const fileName = match ? match[2] : line
        currentFile = { name: fileName, stats: '', lines: [] }
      } else if (currentFile) {
        currentFile.lines.push(line)
      }
    }

    if (currentFile) {
      files.push(currentFile)
    }

    return files
  }

  const toggleFileExpanded = (fileName: string) => {
    setExpandedFiles((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(fileName)) {
        newSet.delete(fileName)
      } else {
        newSet.add(fileName)
      }
      return newSet
    })
  }

  const getDiffStats = (lines: string[]) => {
    let added = 0
    let removed = 0
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) added++
      if (line.startsWith('-') && !line.startsWith('---')) removed++
    }
    return { added, removed }
  }

  const maxColumn = useMemo(() => {
    return Math.max(...commits.map((c) => c.column), 0)
  }, [commits])

  const commitIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    commits.forEach((c, idx) => map.set(c.hash, idx))
    return map
  }, [commits])

  const graphWidth = (maxColumn + 1) * COLUMN_WIDTH + GRAPH_PADDING * 2
  const graphHeight = commits.length * ROW_HEIGHT + GRAPH_PADDING * 2

  const renderConnections = () => {
    const paths: ReactElement[] = []

    commits.forEach((commit, index) => {
      const x1 = GRAPH_PADDING + commit.column * COLUMN_WIDTH
      const y1 = GRAPH_PADDING + index * ROW_HEIGHT + ROW_HEIGHT / 2

      commit.parents.forEach((parentHash) => {
        const parentIndex = commitIndexMap.get(parentHash)
        if (parentIndex !== undefined) {
          const parentCommit = commits[parentIndex]
          const x2 = GRAPH_PADDING + parentCommit.column * COLUMN_WIDTH
          const y2 = GRAPH_PADDING + parentIndex * ROW_HEIGHT + ROW_HEIGHT / 2
          const color = COLORS[commit.color % COLORS.length]

          if (commit.column === parentCommit.column) {
            paths.push(
              <line
                key={`${commit.hash}-${parentHash}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={2}
              />
            )
          } else {
            const midY = y1 + (y2 - y1) * 0.3
            paths.push(
              <path
                key={`${commit.hash}-${parentHash}`}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                stroke={color}
                strokeWidth={2}
                fill="none"
              />
            )
          }
        }
      })
    })

    return paths
  }

  const renderNodes = () => {
    return commits.map((commit, index) => {
      const x = GRAPH_PADDING + commit.column * COLUMN_WIDTH
      const y = GRAPH_PADDING + index * ROW_HEIGHT + ROW_HEIGHT / 2
      const color = COLORS[commit.color % COLORS.length]
      const isSelected = selectedCommit === commit.hash

      return (
        <g key={commit.hash}>
          {isSelected && (
            <circle
              cx={x}
              cy={y}
              r={NODE_RADIUS + 4}
              fill="none"
              stroke={color}
              strokeWidth={2}
              opacity={0.5}
            />
          )}
          <circle
            cx={x}
            cy={y}
            r={NODE_RADIUS}
            fill={color}
            stroke="#fff"
            strokeWidth={2}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setSelectedCommit(commit.hash === selectedCommit ? null : commit.hash)}
          />
        </g>
      )
    })
  }

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.1, 2))
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.1, 0.5))

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="py-4 text-center">
          <p className="text-destructive text-sm mb-2">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchGraph}>
            다시 시도
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (commits.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm mb-2">아직 커밋이 없습니다</p>
          <p className="text-xs text-muted-foreground">첫 번째 커밋을 만들어보세요</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-1.5 px-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">커밋 그래프</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomOut}>
              <ZoomOut className="w-3 h-3" />
            </Button>
            <span className="text-[10px] text-muted-foreground w-8 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomIn}>
              <ZoomIn className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchGraph}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <div className="flex h-full border-t overflow-hidden">
          {/* 그래프 영역 */}
          <div className="flex-shrink-0 border-r bg-muted/20 overflow-auto">
            <svg
              width={graphWidth * scale}
              height={graphHeight * scale}
              viewBox={`0 0 ${graphWidth} ${graphHeight}`}
              className="block"
            >
              {renderConnections()}
              {renderNodes()}
            </svg>
          </div>

          {/* 커밋 목록 */}
          <div className="flex-1 overflow-auto">
            <div style={{ minHeight: graphHeight * scale }}>
              {commits.map((commit) => (
                <ContextMenu key={commit.hash}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        'flex items-center gap-1.5 px-1.5 border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer',
                        selectedCommit === commit.hash && 'bg-primary/10'
                      )}
                      style={{ height: ROW_HEIGHT * scale }}
                      onClick={() =>
                        setSelectedCommit(commit.hash === selectedCommit ? null : commit.hash)
                      }
                    >
                      {/* 브랜치/태그 뱃지 */}
                      <div className="flex items-center gap-0.5 min-w-[80px] max-w-[120px]">
                        {commit.branches.slice(0, 1).map((branch) => {
                          const isRemote = branch.includes('origin/') || branch.includes('remotes/')
                          const isHead = branch.includes('HEAD')
                          const displayName = branch.replace('origin/', '').replace('remotes/', '')

                          return (
                            <Badge
                              key={branch}
                              variant={isHead ? 'default' : 'secondary'}
                              className={cn(
                                'text-[10px] px-1 py-0 h-4 truncate max-w-[70px] gap-0.5',
                                isRemote && !isHead && 'bg-blue-500/10 text-blue-600',
                                !isRemote && !isHead && 'bg-green-500/10 text-green-600'
                              )}
                            >
                              {isRemote ? <Cloud className="w-2.5 h-2.5" /> : <Monitor className="w-2.5 h-2.5" />}
                              {displayName}
                            </Badge>
                          )
                        })}
                        {/* 추가 브랜치들 아이콘으로 표시 */}
                        {commit.branches.slice(1).map((branch) => {
                          const isRemote = branch.includes('origin/') || branch.includes('remotes/')
                          return (
                            <span
                              key={branch}
                              className={cn(
                                'flex-shrink-0 rounded p-0.5',
                                isRemote ? 'bg-blue-500/20 text-blue-600' : 'bg-green-500/20 text-green-600'
                              )}
                              title={branch}
                            >
                              {isRemote ? <Cloud className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                            </span>
                          )
                        })}
                      </div>

                      {/* 커밋 해시 */}
                      <code
                        className="text-[10px] font-mono px-1 rounded bg-muted/50"
                        style={{ color: COLORS[commit.color % COLORS.length] }}
                      >
                        {commit.hash_short}
                      </code>

                      {/* 커밋 메시지 */}
                      <span className="flex-1 text-[11px] truncate">{commit.message}</span>

                      {/* 작성자 */}
                      <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                        {commit.author}
                      </span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-52">
                    {/* 복사 */}
                    <ContextMenuItem onClick={() => handleCopyHash(commit.hash)}>
                      <Copy className="w-4 h-4 mr-2" />
                      해시 복사
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleCopyHash(commit.hash_short)}>
                      <Copy className="w-4 h-4 mr-2" />
                      짧은 해시 복사
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    {/* 체크아웃 & 브랜치 */}
                    <ContextMenuItem onClick={() => handleCheckout(commit.hash)}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      이 커밋으로 체크아웃
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleCreateBranch(commit.hash)}>
                      <GitBranch className="w-4 h-4 mr-2" />
                      여기서 브랜치 생성
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleCreateTag(commit.hash)}>
                      <Tag className="w-4 h-4 mr-2" />
                      태그 생성
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    {/* Cherry-pick & Revert */}
                    <ContextMenuItem onClick={() => handleCherryPick(commit.hash)}>
                      <CherryIcon className="w-4 h-4 mr-2" />
                      Cherry-pick
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleRevert(commit.hash)}>
                      <Undo2 className="w-4 h-4 mr-2" />
                      Revert
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    {/* 브랜치가 있는 경우 브랜치 작업 */}
                    {commit.branches.length > 0 && (
                      <>
                        <ContextMenuSub>
                          <ContextMenuSubTrigger>
                            <GitBranch className="w-4 h-4 mr-2" />
                            브랜치 작업
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent className="w-48">
                            {commit.branches
                              .filter(b => !b.includes('HEAD') && !b.includes('origin/'))
                              .map((branch) => (
                                <ContextMenuSub key={branch}>
                                  <ContextMenuSubTrigger className="text-xs">
                                    {branch}
                                  </ContextMenuSubTrigger>
                                  <ContextMenuSubContent className="w-40">
                                    <ContextMenuItem onClick={() => handleMergeBranch(branch)}>
                                      <GitMerge className="w-4 h-4 mr-2" />
                                      Merge
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => handleRebase(branch)}>
                                      <GitBranch className="w-4 h-4 mr-2" />
                                      Rebase
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => handleRenameBranch(branch)}>
                                      <Edit className="w-4 h-4 mr-2" />
                                      이름 변경
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onClick={() => handleDeleteBranch(branch)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      삭제
                                    </ContextMenuItem>
                                  </ContextMenuSubContent>
                                </ContextMenuSub>
                              ))}
                          </ContextMenuSubContent>
                        </ContextMenuSub>
                        <ContextMenuSeparator />
                      </>
                    )}

                    {/* Stash */}
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <Archive className="w-4 h-4 mr-2" />
                        Stash
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-40">
                        <ContextMenuItem onClick={handleStashSave}>
                          <Archive className="w-4 h-4 mr-2" />
                          Stash 저장
                        </ContextMenuItem>
                        <ContextMenuItem onClick={handleStashPop}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Stash Pop
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>

                    <ContextMenuSeparator />

                    {/* Reset */}
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-40">
                        <ContextMenuItem onClick={() => handleResetTo(commit.hash, 'soft')}>
                          Reset --soft
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleResetTo(commit.hash, 'mixed')}>
                          Reset --mixed
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => handleResetTo(commit.hash, 'hard')}
                          className="text-destructive focus:text-destructive"
                        >
                          Reset --hard
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          </div>
        </div>

        {/* 선택된 커밋 상세 */}
        {selectedCommit && (
          <div className="p-3 border-t bg-muted/30">
            {(() => {
              const commit = commits.find((c) => c.hash === selectedCommit)
              if (!commit) return null

              return (
                <div className="space-y-2">
                  {/* 해시 & 브랜치/태그 */}
                  <div className="flex items-start gap-2">
                    <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded select-all">
                      {commit.hash}
                    </code>
                    <div className="flex gap-1 flex-wrap flex-1">
                      {commit.branches.map((branch) => {
                        const isRemote = branch.includes('origin/') || branch.includes('remotes/')
                        const isHead = branch.includes('HEAD')
                        return (
                          <Badge
                            key={branch}
                            variant={isHead ? 'default' : 'secondary'}
                            className={cn(
                              'text-[10px] px-1.5 py-0 h-4 gap-0.5',
                              isRemote && !isHead && 'bg-blue-500/20 text-blue-600',
                              !isRemote && !isHead && 'bg-green-500/20 text-green-600'
                            )}
                          >
                            {isRemote ? <Cloud className="w-2.5 h-2.5" /> : <Monitor className="w-2.5 h-2.5" />}
                            {branch.replace('origin/', '').replace('remotes/', '')}
                          </Badge>
                        )
                      })}
                      {commit.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-700">
                          🏷 {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* 커밋 메시지 */}
                  <div className="bg-background/50 rounded p-2">
                    <p className="text-sm font-medium">{commit.message}</p>
                  </div>

                  {/* 메타 정보 */}
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">작성자:</span>
                      <span>{commit.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">날짜:</span>
                      <span>{new Date(commit.date).toLocaleString('ko-KR')}</span>
                    </div>
                    {commit.parents.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">부모:</span>
                        {commit.parents.map((p) => (
                          <code
                            key={p}
                            className="text-[10px] font-mono bg-muted px-1 rounded cursor-pointer hover:bg-muted/80"
                            onClick={() => setSelectedCommit(p)}
                          >
                            {p.substring(0, 7)}
                          </code>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Diff */}
                  <div className="border rounded overflow-hidden">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50">
                      <div
                        className="flex items-center gap-1.5 flex-1 cursor-pointer hover:opacity-70"
                        onClick={() => setDiffExpanded(!diffExpanded)}
                      >
                        {diffExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        <span className="text-xs font-medium">변경사항</span>
                        {diffLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                        {!diffLoading && commitDiff && (
                          <span className="text-[10px] text-muted-foreground">
                            ({parseDiffByFile(commitDiff).length}개 파일)
                          </span>
                        )}
                      </div>
                      {diffExpanded && !diffLoading && commitDiff && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation()
                              const allFiles = parseDiffByFile(commitDiff).map(f => f.name)
                              setExpandedFiles(new Set(allFiles))
                            }}
                          >
                            모두 펼치기
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedFiles(new Set())
                            }}
                          >
                            모두 접기
                          </Button>
                        </div>
                      )}
                    </div>
                    {diffExpanded && (
                      <div className="max-h-80 overflow-auto bg-background/50">
                        {diffLoading ? (
                          <div className="p-4 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        ) : commitDiff ? (
                          <div className="divide-y divide-border/50">
                            {parseDiffByFile(commitDiff).map((file, fileIdx) => {
                              const stats = getDiffStats(file.lines)
                              const isExpanded = expandedFiles.has(file.name)
                              return (
                                <div key={fileIdx}>
                                  {/* 파일 헤더 */}
                                  <div
                                    className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 cursor-pointer hover:bg-muted/50 sticky top-0"
                                    onClick={() => toggleFileExpanded(file.name)}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3 flex-shrink-0" />
                                    )}
                                    <code className="text-[10px] font-mono truncate flex-1">
                                      {file.name}
                                    </code>
                                    <span className="text-[9px] flex-shrink-0">
                                      {stats.added > 0 && (
                                        <span className="text-green-600">+{stats.added}</span>
                                      )}
                                      {stats.added > 0 && stats.removed > 0 && ' / '}
                                      {stats.removed > 0 && (
                                        <span className="text-red-600">-{stats.removed}</span>
                                      )}
                                    </span>
                                  </div>
                                  {/* 파일 diff 내용 */}
                                  {isExpanded && (
                                    <div className="text-[10px] font-mono leading-tight overflow-x-auto">
                                      {(() => {
                                        let oldLine = 0
                                        let newLine = 0
                                        return file.lines.slice(0, 100).map((line, idx) => {
                                          let className = 'flex whitespace-pre'
                                          let oldNum = ''
                                          let newNum = ''

                                          // Parse @@ header for line numbers
                                          if (line.startsWith('@@')) {
                                            const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
                                            if (match) {
                                              oldLine = parseInt(match[1])
                                              newLine = parseInt(match[2])
                                            }
                                            return (
                                              <div key={idx} className="flex text-blue-500 bg-blue-500/5">
                                                <span className="w-16 text-right pr-1 text-muted-foreground/50 select-none flex-shrink-0">...</span>
                                                <span className="flex-1 pl-1">{line}</span>
                                              </div>
                                            )
                                          }

                                          if (line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
                                            return (
                                              <div key={idx} className="flex text-muted-foreground">
                                                <span className="w-16 text-right pr-1 select-none flex-shrink-0"></span>
                                                <span className="flex-1 pl-1">{line}</span>
                                              </div>
                                            )
                                          }

                                          if (line.startsWith('+')) {
                                            oldNum = ''
                                            newNum = String(newLine++)
                                            className = 'flex bg-green-500/10 text-green-600'
                                          } else if (line.startsWith('-')) {
                                            oldNum = String(oldLine++)
                                            newNum = ''
                                            className = 'flex bg-red-500/10 text-red-600'
                                          } else {
                                            oldNum = String(oldLine++)
                                            newNum = String(newLine++)
                                          }

                                          return (
                                            <div key={idx} className={className}>
                                              <span className="w-8 text-right text-muted-foreground/50 select-none flex-shrink-0 border-r border-border/30 pr-1">
                                                {oldNum}
                                              </span>
                                              <span className="w-8 text-right text-muted-foreground/50 select-none flex-shrink-0 pr-1">
                                                {newNum}
                                              </span>
                                              <span className="flex-1 pl-1">{line}</span>
                                            </div>
                                          )
                                        })
                                      })()}
                                      {file.lines.length > 100 && (
                                        <div className="text-muted-foreground py-1 pl-[68px]">
                                          ... {file.lines.length - 100} more lines
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="p-2 text-[10px] text-muted-foreground text-center">
                            변경사항 없음
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

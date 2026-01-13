import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  File,
  FilePlus,
  FileMinus,
  FileEdit,
  FileQuestion,
  Plus,
  Minus,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { stageFile, unstageFile, stageAll, discardChanges, getDiff, getStagedDiff, type FileStatus } from '@/hooks/useTauriGit'

interface FileStatusViewProps {
  repoPath: string
  files: FileStatus[]
  onRefresh: () => void
}

const statusIcons = {
  modified: FileEdit,
  added: FilePlus,
  deleted: FileMinus,
  renamed: FileEdit,
  untracked: FileQuestion,
  staged: File,
}

const statusColors = {
  modified: 'text-yellow-500',
  added: 'text-green-500',
  deleted: 'text-red-500',
  renamed: 'text-blue-500',
  untracked: 'text-gray-400',
  staged: 'text-green-500',
}

export function FileStatusView({ repoPath, files, onRefresh }: FileStatusViewProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [stagedExpanded, setStagedExpanded] = useState(true)
  const [unstagedExpanded, setUnstagedExpanded] = useState(true)
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set())
  const [diffCache, setDiffCache] = useState<Record<string, string>>({})
  const [loadingDiffs, setLoadingDiffs] = useState<Set<string>>(new Set())

  const stagedFiles = files.filter((f) => f.staged)
  const unstagedFiles = files.filter((f) => !f.staged)

  const handleToggleSelect = (path: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(path)) {
      newSelected.delete(path)
    } else {
      newSelected.add(path)
    }
    setSelectedFiles(newSelected)
  }

  const handleToggleDiff = async (filePath: string, staged: boolean) => {
    const key = `${staged ? 'staged' : 'unstaged'}_${filePath}`

    if (expandedDiffs.has(key)) {
      const newExpanded = new Set(expandedDiffs)
      newExpanded.delete(key)
      setExpandedDiffs(newExpanded)
      return
    }

    if (diffCache[key]) {
      const newExpanded = new Set(expandedDiffs)
      newExpanded.add(key)
      setExpandedDiffs(newExpanded)
      return
    }

    setLoadingDiffs((prev) => new Set(prev).add(key))
    try {
      const diff = staged
        ? await getStagedDiff(repoPath)
        : await getDiff(repoPath, filePath)

      setDiffCache((prev) => ({ ...prev, [key]: diff || '' }))
      const newExpanded = new Set(expandedDiffs)
      newExpanded.add(key)
      setExpandedDiffs(newExpanded)
    } catch {
      toast.error('Diff를 가져오지 못했습니다')
    } finally {
      setLoadingDiffs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    }
  }

  const handleStage = async (filePath: string) => {
    try {
      await stageFile(repoPath, filePath)
      toast.success('스테이지됨')
      onRefresh()
    } catch {
      toast.error('Stage 실패')
    }
  }

  const handleUnstage = async (filePath: string) => {
    try {
      await unstageFile(repoPath, filePath)
      toast.success('언스테이지됨')
      onRefresh()
    } catch {
      toast.error('Unstage 실패')
    }
  }

  const handleDiscard = async (filePath: string) => {
    if (!confirm(`${filePath} 변경사항을 되돌리시겠습니까?`)) return

    try {
      await discardChanges(repoPath, filePath)
      toast.success('변경사항 되돌림')
      onRefresh()
    } catch {
      toast.error('Discard 실패')
    }
  }

  const handleStageAll = async () => {
    try {
      await stageAll(repoPath)
      toast.success('모두 스테이지됨')
      onRefresh()
    } catch {
      toast.error('Stage All 실패')
    }
  }

  const getDiffStats = (diff: string) => {
    const lines = diff.split('\n')
    let added = 0
    let removed = 0
    lines.forEach((line) => {
      if (line.startsWith('+') && !line.startsWith('+++')) added++
      if (line.startsWith('-') && !line.startsWith('---')) removed++
    })
    return { added, removed }
  }

  const renderDiff = (diff: string) => {
    if (!diff) return <div className="p-2 text-[10px] text-muted-foreground">변경사항 없음</div>

    const lines = diff.split('\n')
    return (
      <div className="bg-muted/30 border-t overflow-x-auto max-h-40">
        <pre className="text-[10px] font-mono p-1.5 leading-tight">
          {lines.slice(0, 50).map((line, idx) => {
            let className = 'block'
            if (line.startsWith('+') && !line.startsWith('+++')) {
              className = 'block bg-green-500/10 text-green-600'
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              className = 'block bg-red-500/10 text-red-600'
            } else if (line.startsWith('@@')) {
              className = 'block text-blue-500'
            } else if (line.startsWith('diff') || line.startsWith('index')) {
              className = 'block text-muted-foreground'
            }
            return (
              <code key={idx} className={className}>
                {line}
              </code>
            )
          })}
          {lines.length > 50 && <code className="block text-muted-foreground">... {lines.length - 50} more lines</code>}
        </pre>
      </div>
    )
  }

  const renderFileList = (
    fileList: FileStatus[],
    isStaged: boolean,
    expanded: boolean,
    setExpanded: (v: boolean) => void,
    title: string
  ) => (
    <div className="border rounded-md overflow-hidden">
      <div
        className="flex items-center justify-between px-2 py-1.5 bg-muted/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5">
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span className="text-xs font-medium">{title}</span>
          <span className="text-[10px] text-muted-foreground">({fileList.length})</span>
        </div>
        {!isStaged && fileList.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-1.5 text-[10px]"
            onClick={(e) => {
              e.stopPropagation()
              handleStageAll()
            }}
          >
            <Plus className="w-3 h-3 mr-0.5" />
            All
          </Button>
        )}
      </div>

      {expanded && fileList.length > 0 && (
        <div className="divide-y divide-border/50">
          {fileList.map((file) => {
            const Icon = statusIcons[file.status] || File
            const color = statusColors[file.status] || 'text-gray-500'
            const diffKey = `${isStaged ? 'staged' : 'unstaged'}_${file.path}`
            const isDiffExpanded = expandedDiffs.has(diffKey)
            const isDiffLoading = loadingDiffs.has(diffKey)
            const diff = diffCache[diffKey]
            const stats = diff ? getDiffStats(diff) : null

            return (
              <div key={file.path}>
                <div
                  className={cn(
                    'flex items-center justify-between px-1.5 py-1 hover:bg-muted/30 group cursor-pointer',
                    isDiffExpanded && 'bg-muted/20'
                  )}
                  onClick={() => handleToggleDiff(file.path, isStaged)}
                >
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <Checkbox
                      checked={selectedFiles.has(file.path)}
                      onCheckedChange={() => handleToggleSelect(file.path)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3 w-3"
                    />
                    {isDiffExpanded ? (
                      <ChevronDown className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                    ) : isDiffLoading ? (
                      <Loader2 className="w-3 h-3 flex-shrink-0 animate-spin" />
                    ) : (
                      <ChevronRight className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                    )}
                    <Icon className={`w-3 h-3 flex-shrink-0 ${color}`} />
                    <span className="text-[11px] truncate">{file.path}</span>
                    {stats && (
                      <span className="text-[9px] text-muted-foreground flex-shrink-0">
                        {stats.added > 0 && <span className="text-green-600">+{stats.added}</span>}
                        {stats.added > 0 && stats.removed > 0 && '/'}
                        {stats.removed > 0 && <span className="text-red-600">-{stats.removed}</span>}
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isStaged ? (
                      <Button
                        variant="ghost"
                        className="h-5 w-5 p-0"
                        onClick={() => handleUnstage(file.path)}
                        title="Unstage"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          className="h-5 w-5 p-0"
                          onClick={() => handleStage(file.path)}
                          title="Stage"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        {file.status !== 'untracked' && (
                          <Button
                            variant="ghost"
                            className="h-5 w-5 p-0"
                            onClick={() => handleDiscard(file.path)}
                            title="Discard"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {isDiffExpanded && diff !== undefined && renderDiff(diff)}
              </div>
            )
          })}
        </div>
      )}

      {expanded && fileList.length === 0 && (
        <div className="py-3 text-center text-[10px] text-muted-foreground">
          {isStaged ? '스테이지된 파일 없음' : '변경된 파일 없음'}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-2">
      {renderFileList(stagedFiles, true, stagedExpanded, setStagedExpanded, 'Staged')}
      {renderFileList(unstagedFiles, false, unstagedExpanded, setUnstagedExpanded, 'Changes')}
    </div>
  )
}

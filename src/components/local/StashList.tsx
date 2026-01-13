import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Archive,
  MoreVertical,
  ExternalLink,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { invoke } from '@tauri-apps/api/core'

interface StashListProps {
  repoPath: string
  onRefresh?: () => void
}

interface StashEntry {
  index: number
  message: string
  branch: string
}

export function StashList({ repoPath, onRefresh }: StashListProps) {
  const [stashes, setStashes] = useState<StashEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchStashes = async () => {
    setLoading(true)
    try {
      const list = await invoke<string[]>('stash_list', { path: repoPath })
      const parsed = list.map((line, index) => {
        // Parse "stash@{0}: On branch: message" format
        const match = line.match(/stash@\{(\d+)\}:\s*(?:On\s+(\S+):\s*)?(.*)/)
        return {
          index,
          branch: match?.[2] || '',
          message: match?.[3] || line,
        }
      })
      setStashes(parsed)
    } catch {
      setStashes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStashes()
  }, [repoPath])

  const handleStashSave = async () => {
    const message = prompt('Stash 메시지 (선택):')
    setLoading(true)
    try {
      await invoke('stash_save', { path: repoPath, message: message || null })
      toast.success('Stash 저장됨')
      fetchStashes()
      onRefresh?.()
    } catch {
      toast.error('Stash 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async (index: number) => {
    setActionLoading(index)
    try {
      await invoke('stash_apply', { path: repoPath, index })
      toast.success('Stash 적용됨')
      onRefresh?.()
    } catch {
      toast.error('Stash 적용 실패')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePop = async (index: number) => {
    setActionLoading(index)
    try {
      await invoke('stash_pop', { path: repoPath })
      toast.success('Stash Pop 완료')
      fetchStashes()
      onRefresh?.()
    } catch {
      toast.error('Stash Pop 실패')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDrop = async (index: number) => {
    if (!confirm(`stash@{${index}}를 삭제하시겠습니까?`)) return
    setActionLoading(index)
    try {
      await invoke('stash_drop', { path: repoPath, index })
      toast.success('Stash 삭제됨')
      fetchStashes()
    } catch {
      toast.error('Stash 삭제 실패')
    } finally {
      setActionLoading(null)
    }
  }

  const handleClear = async () => {
    if (!confirm('모든 stash를 삭제하시겠습니까?')) return
    setLoading(true)
    try {
      // Drop all stashes one by one from the end
      for (let i = stashes.length - 1; i >= 0; i--) {
        await invoke('stash_drop', { path: repoPath, index: i })
      }
      toast.success('모든 Stash 삭제됨')
      fetchStashes()
    } catch {
      toast.error('Stash 삭제 실패')
      fetchStashes()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-md overflow-hidden">
      {/* 헤더 */}
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
          <Archive className="w-3 h-3" />
          <span className="text-xs font-medium">Stash</span>
          {stashes.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
              {stashes.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={handleStashSave}
            disabled={loading}
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={fetchStashes}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Stash 목록 */}
      {expanded && (
        <div className="divide-y divide-border/50">
          {stashes.length === 0 ? (
            <div className="py-3 text-center text-[10px] text-muted-foreground">
              저장된 stash 없음
            </div>
          ) : (
            <>
              {stashes.map((stash) => (
                <div
                  key={stash.index}
                  className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/30 group"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <code className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                      @{stash.index}
                    </code>
                    {stash.branch && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 flex-shrink-0">
                        {stash.branch}
                      </Badge>
                    )}
                    <span className="text-[11px] truncate">{stash.message}</span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    {actionLoading === stash.index ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem onClick={() => handleApply(stash.index)}>
                            <ExternalLink className="w-3 h-3 mr-2" />
                            Apply
                          </DropdownMenuItem>
                          {stash.index === 0 && (
                            <DropdownMenuItem onClick={() => handlePop(stash.index)}>
                              <Archive className="w-3 h-3 mr-2" />
                              Pop
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDrop(stash.index)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-3 h-3 mr-2" />
                            Drop
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
              {stashes.length > 0 && (
                <div className="px-2 py-1 bg-muted/20">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-full text-[10px] text-destructive hover:text-destructive"
                    onClick={handleClear}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    모두 삭제
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

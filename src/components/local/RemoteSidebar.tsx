import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Cloud,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  MoreVertical,
  GitBranch,
  Download,
  Loader2,
  Check,
  Copy,
  Scissors,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  getRemotes,
  addRemote,
  removeRemote,
  setRemoteUrl,
  getRemoteBranches,
  checkoutRemoteBranch,
  deleteRemoteBranch,
  pruneRemote,
  fetchFromRemote,
  type RemoteInfo,
  type RemoteBranchInfo,
} from '@/hooks/useTauriGit'

interface RemoteSidebarProps {
  repoPath: string
  onRefresh?: () => void
  compact?: boolean
}

export function RemoteSidebar({ repoPath, onRefresh, compact = false }: RemoteSidebarProps) {
  const [remotes, setRemotes] = useState<RemoteInfo[]>([])
  const [remoteBranches, setRemoteBranches] = useState<RemoteBranchInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [selectedRemote, setSelectedRemote] = useState<RemoteInfo | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<RemoteBranchInfo | null>(null)

  // Form states
  const [newRemoteName, setNewRemoteName] = useState('')
  const [newRemoteUrl, setNewRemoteUrl] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [localBranchName, setLocalBranchName] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [remotesData, branchesData] = await Promise.all([
        getRemotes(repoPath),
        getRemoteBranches(repoPath),
      ])
      setRemotes(remotesData)
      setRemoteBranches(branchesData)
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [repoPath])

  const handleAddRemote = async () => {
    if (!newRemoteName.trim() || !newRemoteUrl.trim()) {
      toast.error('이름과 URL을 입력하세요')
      return
    }

    setActionLoading('add')
    try {
      await addRemote(repoPath, newRemoteName.trim(), newRemoteUrl.trim())
      toast.success(`${newRemoteName} 추가됨`)
      setAddDialogOpen(false)
      setNewRemoteName('')
      setNewRemoteUrl('')
      fetchData()
      onRefresh?.()
    } catch {
      toast.error('추가 실패')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemoveRemote = async (name: string) => {
    setActionLoading(`remove-${name}`)
    try {
      await removeRemote(repoPath, name)
      toast.success(`${name} 삭제됨`)
      fetchData()
      onRefresh?.()
    } catch {
      toast.error('삭제 실패')
    } finally {
      setActionLoading(null)
    }
  }

  const handleEditRemote = async () => {
    if (!selectedRemote || !editUrl.trim()) return

    setActionLoading('edit')
    try {
      await setRemoteUrl(repoPath, selectedRemote.name, editUrl.trim())
      toast.success('URL 변경됨')
      setEditDialogOpen(false)
      setSelectedRemote(null)
      setEditUrl('')
      fetchData()
    } catch {
      toast.error('변경 실패')
    } finally {
      setActionLoading(null)
    }
  }

  const handleFetch = async (remoteName: string) => {
    setActionLoading(`fetch-${remoteName}`)
    try {
      await fetchFromRemote(repoPath, remoteName)
      toast.success(`${remoteName} fetch 완료`)
      fetchData()
      onRefresh?.()
    } catch {
      toast.error('Fetch 실패')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePrune = async (remoteName: string) => {
    setActionLoading(`prune-${remoteName}`)
    try {
      await pruneRemote(repoPath, remoteName)
      toast.success('정리 완료')
      fetchData()
    } catch {
      toast.error('Prune 실패')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCheckoutBranch = async () => {
    if (!selectedBranch || !localBranchName.trim()) return

    setActionLoading('checkout')
    try {
      await checkoutRemoteBranch(repoPath, selectedBranch.name, localBranchName.trim())
      toast.success(`${localBranchName} 체크아웃 완료`)
      setCheckoutDialogOpen(false)
      setSelectedBranch(null)
      setLocalBranchName('')
      fetchData()
      onRefresh?.()
    } catch {
      toast.error('체크아웃 실패')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteRemoteBranch = async (branch: RemoteBranchInfo) => {
    const branchName = branch.name.replace(`${branch.remote}/`, '')
    setActionLoading(`delete-branch-${branch.name}`)
    try {
      await deleteRemoteBranch(repoPath, branch.remote, branchName)
      toast.success('브랜치 삭제됨')
      fetchData()
    } catch {
      toast.error('삭제 실패')
    } finally {
      setActionLoading(null)
    }
  }

  const openEditDialog = (remote: RemoteInfo) => {
    setSelectedRemote(remote)
    setEditUrl(remote.fetch_url)
    setEditDialogOpen(true)
  }

  const openCheckoutDialog = (branch: RemoteBranchInfo) => {
    setSelectedBranch(branch)
    setLocalBranchName(branch.name.replace(`${branch.remote}/`, ''))
    setCheckoutDialogOpen(true)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('복사됨')
  }

  // Group branches by remote
  const branchesByRemote = remoteBranches.reduce((acc, branch) => {
    if (!acc[branch.remote]) {
      acc[branch.remote] = []
    }
    acc[branch.remote].push(branch)
    return acc
  }, {} as Record<string, RemoteBranchInfo[]>)

  if (loading) {
    if (compact) {
      return (
        <Card className="h-full">
          <CardContent className="p-3 flex items-center justify-center h-full">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )
    }
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Compact 모드 - Accordion 형태
  if (compact) {
    return (
      <Card className="p-2">
        <Accordion type="single" collapsible>
          <AccordionItem value="remotes" className="border-0">
            <AccordionTrigger className="p-0 hover:no-underline [&>svg]:h-3 [&>svg]:w-3">
              <div className="flex flex-col items-start w-full">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold">원격 저장소</span>
                </div>
                <div className="flex items-center gap-2 h-6 text-muted-foreground">
                  <span className="text-xs">
                    {remotes.length > 0 ? remotes.map(r => r.name).join(', ') : '없음'}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {remotes.length}
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-0">
              {/* 원격 저장소 목록 */}
              <div className="max-h-32 overflow-auto border-t pt-2">
                <div className="flex items-center justify-end gap-1 mb-1">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={fetchData}>
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                  <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5">
                        <Plus className="w-3 h-3" />
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </div>
                {remotes.length === 0 ? (
                  <div className="text-center py-1 text-xs text-muted-foreground">
                    원격 저장소 없음
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {remotes.map((remote) => (
                      <div
                        key={remote.name}
                        className="flex items-center justify-between p-1 rounded hover:bg-muted"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <Cloud className="w-3 h-3 text-blue-500 flex-shrink-0" />
                            <span className="text-[11px] font-medium">{remote.name}</span>
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                              {branchesByRemote[remote.name]?.length || 0}
                            </Badge>
                          </div>
                          <div className="text-[9px] text-muted-foreground truncate pl-4">
                            {remote.fetch_url}
                          </div>
                        </div>
                        <div className="flex items-center ml-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => { e.stopPropagation(); handleFetch(remote.name); }}
                            disabled={actionLoading === `fetch-${remote.name}`}
                          >
                            {actionLoading === `fetch-${remote.name}` ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Download className="w-2.5 h-2.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => { e.stopPropagation(); openEditDialog(remote); }}
                          >
                            <Edit className="w-2.5 h-2.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleRemoveRemote(remote.name); }}
                            disabled={actionLoading === `remove-${remote.name}`}
                          >
                            {actionLoading === `remove-${remote.name}` ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-2.5 h-2.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Dialog는 Card 외부로 이동하여 제대로 작동하게 함 */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>원격 저장소 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">이름</label>
                <Input
                  placeholder="origin"
                  value={newRemoteName}
                  onChange={(e) => setNewRemoteName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                <Input
                  placeholder="https://github.com/user/repo.git"
                  value={newRemoteUrl}
                  onChange={(e) => setNewRemoteUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={handleAddRemote} disabled={actionLoading === 'add'}>
                {actionLoading === 'add' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                추가
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* URL 편집 다이얼로그 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>URL 변경</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">새 URL</label>
                <Input
                  placeholder="https://github.com/user/repo.git"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={handleEditRemote} disabled={actionLoading === 'edit'}>
                {actionLoading === 'edit' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                변경
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    )
  }

  return (
    <div className="p-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
          <Cloud className="w-3 h-3" />
          원격 저장소
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchData}>
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="w-3 h-3" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>원격 저장소 추가</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">이름</label>
                  <Input
                    placeholder="origin"
                    value={newRemoteName}
                    onChange={(e) => setNewRemoteName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL</label>
                  <Input
                    placeholder="https://github.com/user/repo.git"
                    value={newRemoteUrl}
                    onChange={(e) => setNewRemoteUrl(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleAddRemote} disabled={actionLoading === 'add'}>
                  {actionLoading === 'add' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  추가
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 원격 저장소 목록 */}
      {remotes.length === 0 ? (
        <div className="text-center py-4">
          <Cloud className="w-8 h-8 mx-auto text-muted-foreground/50 mb-1" />
          <p className="text-xs text-muted-foreground">원격 저장소 없음</p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-1">
          {remotes.map((remote) => (
            <AccordionItem
              key={remote.name}
              value={remote.name}
              className="border rounded-md"
            >
              <AccordionTrigger className="hover:no-underline px-2 py-1.5 text-sm">
                <div className="flex items-center gap-2 flex-1">
                  <Cloud className="w-3 h-3 text-blue-500" />
                  <span className="font-medium text-xs">{remote.name}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {branchesByRemote[remote.name]?.length || 0}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-2">
                {/* URL */}
                <div className="mb-2">
                  <div
                    className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-1 cursor-pointer hover:bg-muted"
                    onClick={() => copyToClipboard(remote.fetch_url)}
                  >
                    <code className="truncate flex-1">{remote.fetch_url}</code>
                    <Copy className="w-2.5 h-2.5 flex-shrink-0" />
                  </div>
                </div>

                {/* 액션 버튼들 */}
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => handleFetch(remote.name)}
                    disabled={actionLoading === `fetch-${remote.name}`}
                  >
                    {actionLoading === `fetch-${remote.name}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => handlePrune(remote.name)}
                    disabled={actionLoading === `prune-${remote.name}`}
                  >
                    {actionLoading === `prune-${remote.name}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Scissors className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => openEditDialog(remote)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveRemote(remote.name)}
                    disabled={actionLoading === `remove-${remote.name}`}
                  >
                    {actionLoading === `remove-${remote.name}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>

                {/* 원격 브랜치 */}
                {branchesByRemote[remote.name]?.length > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground mb-1">브랜치</p>
                    {branchesByRemote[remote.name].slice(0, 5).map((branch) => (
                      <div
                        key={branch.name}
                        className={cn(
                          'flex items-center justify-between py-1 px-1.5 rounded text-xs hover:bg-muted/50 group',
                          branch.is_tracking && 'bg-primary/5'
                        )}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GitBranch className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">
                            {branch.name.replace(`${remote.name}/`, '')}
                          </span>
                          {branch.is_tracking && (
                            <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => openCheckoutDialog(branch)}>
                              <ChevronRight className="w-3 h-3 mr-2" />
                              체크아웃
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteRemoteBranch(branch)}
                            >
                              <Trash2 className="w-3 h-3 mr-2" />
                              삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                    {branchesByRemote[remote.name].length > 5 && (
                      <p className="text-[10px] text-muted-foreground text-center py-1">
                        +{branchesByRemote[remote.name].length - 5} more
                      </p>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* URL 편집 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>URL 변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">새 URL</label>
              <Input
                placeholder="https://github.com/user/repo.git"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleEditRemote} disabled={actionLoading === 'edit'}>
              {actionLoading === 'edit' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 브랜치 체크아웃 다이얼로그 */}
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>브랜치 체크아웃</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{selectedBranch?.name}</span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">로컬 브랜치 이름</label>
              <Input
                value={localBranchName}
                onChange={(e) => setLocalBranchName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCheckoutBranch} disabled={actionLoading === 'checkout'}>
              {actionLoading === 'checkout' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              체크아웃
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

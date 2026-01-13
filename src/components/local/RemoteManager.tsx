import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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

interface RemoteManagerProps {
  repoPath: string
  onRefresh?: () => void
}

export function RemoteManager({ repoPath, onRefresh }: RemoteManagerProps) {
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
    } catch (err) {
      toast.error('원격 저장소 정보를 가져오지 못했습니다')
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
      toast.success(`${newRemoteName} 원격 저장소를 추가했습니다`)
      setAddDialogOpen(false)
      setNewRemoteName('')
      setNewRemoteUrl('')
      fetchData()
      onRefresh?.()
    } catch (err) {
      toast.error('원격 저장소 추가에 실패했습니다')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemoveRemote = async (name: string) => {
    setActionLoading(`remove-${name}`)
    try {
      await removeRemote(repoPath, name)
      toast.success(`${name} 원격 저장소를 삭제했습니다`)
      fetchData()
      onRefresh?.()
    } catch (err) {
      toast.error('원격 저장소 삭제에 실패했습니다')
    } finally {
      setActionLoading(null)
    }
  }

  const handleEditRemote = async () => {
    if (!selectedRemote || !editUrl.trim()) return

    setActionLoading('edit')
    try {
      await setRemoteUrl(repoPath, selectedRemote.name, editUrl.trim())
      toast.success('URL이 변경되었습니다')
      setEditDialogOpen(false)
      setSelectedRemote(null)
      setEditUrl('')
      fetchData()
    } catch (err) {
      toast.error('URL 변경에 실패했습니다')
    } finally {
      setActionLoading(null)
    }
  }

  const handleFetch = async (remoteName: string) => {
    setActionLoading(`fetch-${remoteName}`)
    try {
      await fetchFromRemote(repoPath, remoteName)
      toast.success(`${remoteName}에서 fetch 완료`)
      fetchData()
      onRefresh?.()
    } catch (err) {
      toast.error('Fetch에 실패했습니다')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePrune = async (remoteName: string) => {
    setActionLoading(`prune-${remoteName}`)
    try {
      await pruneRemote(repoPath, remoteName)
      toast.success(`${remoteName} 정리 완료`)
      fetchData()
    } catch (err) {
      toast.error('Prune에 실패했습니다')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCheckoutBranch = async () => {
    if (!selectedBranch || !localBranchName.trim()) return

    setActionLoading('checkout')
    try {
      await checkoutRemoteBranch(repoPath, selectedBranch.name, localBranchName.trim())
      toast.success(`${localBranchName} 브랜치를 생성하고 체크아웃했습니다`)
      setCheckoutDialogOpen(false)
      setSelectedBranch(null)
      setLocalBranchName('')
      fetchData()
      onRefresh?.()
    } catch (err) {
      toast.error('브랜치 체크아웃에 실패했습니다')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteRemoteBranch = async (branch: RemoteBranchInfo) => {
    const branchName = branch.name.replace(`${branch.remote}/`, '')
    setActionLoading(`delete-branch-${branch.name}`)
    try {
      await deleteRemoteBranch(repoPath, branch.remote, branchName)
      toast.success(`${branch.name} 브랜치를 삭제했습니다`)
      fetchData()
    } catch (err) {
      toast.error('원격 브랜치 삭제에 실패했습니다')
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
    toast.success('클립보드에 복사했습니다')
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
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            원격 저장소
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  추가
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
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {remotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Cloud className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>원격 저장소가 없습니다</p>
            <p className="text-sm">원격 저장소를 추가하세요</p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {remotes.map((remote) => (
              <AccordionItem
                key={remote.name}
                value={remote.name}
                className="border rounded-lg px-3"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 flex-1">
                    <Cloud className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">{remote.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {branchesByRemote[remote.name]?.length || 0} branches
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2 pb-3">
                    {/* URL 정보 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground w-12">Fetch:</span>
                        <code className="flex-1 px-2 py-1 bg-muted rounded text-xs truncate">
                          {remote.fetch_url}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(remote.fetch_url)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      {remote.push_url !== remote.fetch_url && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground w-12">Push:</span>
                          <code className="flex-1 px-2 py-1 bg-muted rounded text-xs truncate">
                            {remote.push_url}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(remote.push_url)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFetch(remote.name)}
                        disabled={actionLoading === `fetch-${remote.name}`}
                      >
                        {actionLoading === `fetch-${remote.name}` ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-1" />
                        )}
                        Fetch
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrune(remote.name)}
                        disabled={actionLoading === `prune-${remote.name}`}
                      >
                        {actionLoading === `prune-${remote.name}` ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Scissors className="w-4 h-4 mr-1" />
                        )}
                        Prune
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(remote)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        URL 변경
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveRemote(remote.name)}
                        disabled={actionLoading === `remove-${remote.name}`}
                      >
                        {actionLoading === `remove-${remote.name}` ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-1" />
                        )}
                        삭제
                      </Button>
                    </div>

                    {/* 원격 브랜치 목록 */}
                    {branchesByRemote[remote.name]?.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <GitBranch className="w-4 h-4" />
                          원격 브랜치
                        </h4>
                        <div className="space-y-1 max-h-48 overflow-auto">
                          {branchesByRemote[remote.name].map((branch) => (
                            <div
                              key={branch.name}
                              className={cn(
                                'flex items-center justify-between p-2 rounded hover:bg-muted/50',
                                branch.is_tracking && 'bg-primary/5 border border-primary/20'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <GitBranch className="w-3 h-3 text-muted-foreground" />
                                <span className="text-sm">
                                  {branch.name.replace(`${remote.name}/`, '')}
                                </span>
                                {branch.is_tracking && (
                                  <Badge variant="default" className="text-xs">
                                    tracking
                                  </Badge>
                                )}
                                <code className="text-xs text-muted-foreground">
                                  {branch.commit}
                                </code>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreVertical className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => openCheckoutDialog(branch)}
                                  >
                                    <Check className="w-4 h-4 mr-2" />
                                    로컬로 체크아웃
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDeleteRemoteBranch(branch)}
                                    disabled={actionLoading === `delete-branch-${branch.name}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    원격 브랜치 삭제
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>

      {/* URL 편집 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>원격 저장소 URL 변경</DialogTitle>
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
            <DialogTitle>원격 브랜치 체크아웃</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{selectedBranch?.name}</span>을 로컬로 체크아웃합니다.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">로컬 브랜치 이름</label>
              <Input
                placeholder="feature/my-branch"
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
    </Card>
  )
}

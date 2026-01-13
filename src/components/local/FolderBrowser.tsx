import { useState, useEffect } from 'react'
import { readDir, exists, stat } from '@tauri-apps/plugin-fs'
import { homeDir, join, dirname } from '@tauri-apps/api/path'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Folder,
  FolderOpen,
  ChevronUp,
  Home,
  Loader2,
  GitBranch,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FolderBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (path: string) => void
  title?: string
  description?: string
}

interface FolderEntry {
  name: string
  path: string
  isGitRepo: boolean
}

export function FolderBrowser({
  open,
  onOpenChange,
  onSelect,
  title = '폴더 선택',
  description = '폴더를 선택하세요',
}: FolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [folders, setFolders] = useState<FolderEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

  // 홈 디렉토리로 초기화
  useEffect(() => {
    if (open && !currentPath) {
      homeDir().then((home) => {
        setCurrentPath(home)
      })
    }
  }, [open, currentPath])

  // 현재 경로의 폴더 목록 로드
  useEffect(() => {
    if (!currentPath || !open) return

    const loadFolders = async () => {
      setLoading(true)
      setSelectedFolder(null)
      try {
        const entries = await readDir(currentPath)
        const folderEntries: FolderEntry[] = []

        for (const entry of entries) {
          // 숨김 폴더가 아닌 경우만
          if (entry.name && !entry.name.startsWith('.')) {
            // Tauri path API를 사용하여 경로 조합
            const folderPath = await join(currentPath, entry.name)

            // stat을 사용하여 디렉토리 여부 확인
            try {
              const fileStat = await stat(folderPath)
              if (!fileStat.isDirectory) continue

              // .git 폴더가 있는지 확인
              let isGitRepo = false
              try {
                const gitPath = await join(folderPath, '.git')
                isGitRepo = await exists(gitPath)
              } catch {
                isGitRepo = false
              }
              folderEntries.push({
                name: entry.name,
                path: folderPath,
                isGitRepo,
              })
            } catch {
              // stat 실패시 무시 (권한 문제 등)
              continue
            }
          }
        }

        // 이름순 정렬
        folderEntries.sort((a, b) => a.name.localeCompare(b.name))
        setFolders(folderEntries)
      } catch (err) {
        console.error('폴더 읽기 실패:', err)
        setFolders([])
      } finally {
        setLoading(false)
      }
    }

    loadFolders()
  }, [currentPath, open])

  const handleFolderDoubleClick = (folder: FolderEntry) => {
    setCurrentPath(folder.path)
  }

  const handleFolderClick = (folder: FolderEntry) => {
    setSelectedFolder(folder.path)
  }

  const handleGoUp = async () => {
    try {
      const parent = await dirname(currentPath)
      // 루트 디렉토리가 아닌 경우에만 이동
      if (parent && parent !== currentPath) {
        setCurrentPath(parent)
      }
    } catch (err) {
      console.error('상위 폴더 이동 실패:', err)
    }
  }

  const handleGoHome = async () => {
    const home = await homeDir()
    setCurrentPath(home)
  }

  const handleSelect = () => {
    if (selectedFolder) {
      onSelect(selectedFolder)
      onOpenChange(false)
      // 상태 초기화
      setSelectedFolder(null)
      setCurrentPath('')
    }
  }

  const handleSelectCurrent = () => {
    onSelect(currentPath)
    onOpenChange(false)
    setSelectedFolder(null)
    setCurrentPath('')
  }

  // 현재 경로 표시 (축약)
  const displayPath = () => {
    const parts = currentPath.split('/')
    if (parts.length <= 4) return currentPath
    return `.../${parts.slice(-3).join('/')}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* 경로 네비게이션 */}
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleGoHome}
            title="홈으로"
          >
            <Home className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleGoUp}
            title="상위 폴더"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <div className="flex-1 text-sm text-muted-foreground truncate" title={currentPath}>
            {displayPath()}
          </div>
        </div>

        {/* 폴더 목록 */}
        <div className="h-72 border rounded-md overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : folders.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              폴더가 없습니다
            </div>
          ) : (
            <div className="p-1">
              {folders.map((folder) => (
                <div
                  key={folder.path}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer',
                    selectedFolder === folder.path
                      ? 'bg-primary/20 border border-primary/30'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => handleFolderClick(folder)}
                  onDoubleClick={() => handleFolderDoubleClick(folder)}
                >
                  {selectedFolder === folder.path ? (
                    <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-sm truncate flex-1">{folder.name}</span>
                  {folder.isGitRepo && (
                    <span title="Git 저장소">
                      <GitBranch className="w-3 h-3 text-green-500 flex-shrink-0" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          더블클릭: 폴더 열기 | 클릭 후 선택: 해당 폴더 선택
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            variant="outline"
            onClick={handleSelectCurrent}
            title="현재 보고 있는 폴더를 선택"
          >
            현재 폴더 선택
          </Button>
          <Button onClick={handleSelect} disabled={!selectedFolder}>
            선택
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

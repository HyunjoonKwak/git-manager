import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Github,
  LogOut,
  Loader2,
  Star,
  List,
  Key,
  ExternalLink,
} from 'lucide-react'
import {
  saveGitHubToken,
  getGitHubToken,
  deleteGitHubToken,
  fetchGitHubUser,
  fetchGitHubRepos,
  getGitHubFavorites,
  type GitHubUser,
  type GitHubRepo,
} from '@/hooks/useGitHub'
import { cn } from '@/lib/utils'

interface GitHubSidebarProps {
  onViewRepos?: (repos: GitHubRepo[], mode: 'all' | 'favorites') => void
}

export function GitHubSidebar({ onViewRepos }: GitHubSidebarProps) {
  const [token, setToken] = useState('')
  const [savedToken, setSavedToken] = useState<string | null>(null)
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [favorites, setFavorites] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'all' | 'favorites' | null>(null)

  // 초기화: 저장된 토큰 로드
  useEffect(() => {
    loadSavedToken()
  }, [])

  const loadSavedToken = async () => {
    try {
      const token = await getGitHubToken()
      if (token) {
        setSavedToken(token)
        await loadUserAndRepos(token)
      }
    } catch (err) {
      console.error('토큰 로드 실패:', err)
    }
  }

  const loadUserAndRepos = async (token: string) => {
    setLoading(true)
    setError(null)
    try {
      const [userData, reposData, favoritesData] = await Promise.all([
        fetchGitHubUser(token),
        fetchGitHubRepos(token),
        getGitHubFavorites(),
      ])
      setUser(userData)
      setRepos(reposData)
      setFavorites(favoritesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결 실패')
      console.error('GitHub 데이터 로드 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!token.trim()) return
    setLoading(true)
    setError(null)
    try {
      await saveGitHubToken(token)
      setSavedToken(token)
      await loadUserAndRepos(token)
      setToken('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await deleteGitHubToken()
      setSavedToken(null)
      setUser(null)
      setRepos([])
      setFavorites([])
      setActiveView(null)
    } catch (err) {
      console.error('연결 해제 실패:', err)
    }
  }

  const handleViewAll = () => {
    setActiveView('all')
    onViewRepos?.(repos, 'all')
  }

  const handleViewFavorites = () => {
    setActiveView('favorites')
    const favoriteRepos = repos.filter((r) => favorites.includes(r.id))
    onViewRepos?.(favoriteRepos, 'favorites')
  }

  // 연결되지 않은 상태
  if (!savedToken || !user) {
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Github className="w-4 h-4" />
          GitHub 연결
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Personal Access Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={loading || !token.trim()}
              className="h-8"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Key className="w-3 h-3" />
              )}
            </Button>
          </div>
          <a
            href="https://github.com/settings/tokens/new?scopes=repo,read:user"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            토큰 생성하기 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    )
  }

  // 연결된 상태
  return (
    <div className="p-3 space-y-3">
      {/* 사용자 정보 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="w-6 h-6">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback>{user.login[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium truncate max-w-[100px]">
            {user.login}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleDisconnect}
          title="연결 해제"
        >
          <LogOut className="w-3 h-3" />
        </Button>
      </div>

      {/* 저장소 버튼 */}
      <div className="space-y-1">
        <Button
          variant={activeView === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          className={cn('w-full justify-start h-8 text-xs')}
          onClick={handleViewAll}
        >
          <List className="w-3 h-3 mr-2" />
          전체 저장소
          <span className="ml-auto text-muted-foreground">{repos.length}</span>
        </Button>
        <Button
          variant={activeView === 'favorites' ? 'secondary' : 'ghost'}
          size="sm"
          className={cn('w-full justify-start h-8 text-xs')}
          onClick={handleViewFavorites}
        >
          <Star className="w-3 h-3 mr-2" />
          즐겨찾기
          <span className="ml-auto text-muted-foreground">
            {favorites.length}
          </span>
        </Button>
      </div>
    </div>
  )
}

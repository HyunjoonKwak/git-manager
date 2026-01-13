import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Star,
  GitFork,
  Lock,
  Unlock,
  Search,
  LayoutGrid,
  List,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'
import {
  addGitHubFavorite,
  removeGitHubFavorite,
  getGitHubFavorites,
  type GitHubRepo,
} from '@/hooks/useGitHub'
import { cn } from '@/lib/utils'
import { open } from '@tauri-apps/plugin-shell'

interface GitHubReposViewProps {
  repos: GitHubRepo[]
  mode: 'all' | 'favorites'
  onClose?: () => void
}

export function GitHubReposView({ repos, mode }: GitHubReposViewProps) {
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<number[]>([])
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    try {
      const favs = await getGitHubFavorites()
      setFavorites(favs)
    } catch (err) {
      console.error('즐겨찾기 로드 실패:', err)
    }
  }

  const toggleFavorite = async (repoId: number) => {
    try {
      if (favorites.includes(repoId)) {
        await removeGitHubFavorite(repoId)
        setFavorites((prev) => prev.filter((id) => id !== repoId))
      } else {
        await addGitHubFavorite(repoId)
        setFavorites((prev) => [...prev, repoId])
      }
    } catch (err) {
      console.error('즐겨찾기 토글 실패:', err)
    }
  }

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (err) {
      console.error('복사 실패:', err)
    }
  }

  const filteredRepos = useMemo(() => {
    let filtered = repos

    // 즐겨찾기 모드일 때는 즐겨찾기만 표시
    if (mode === 'favorites') {
      filtered = repos.filter((r) => favorites.includes(r.id))
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.full_name.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query) ||
          r.language?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [repos, mode, favorites, searchQuery])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {mode === 'all' ? '전체 저장소' : '즐겨찾기'}
          </h2>
          <Badge variant="secondary">{filteredRepos.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'card' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('card')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 검색 */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="저장소 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 저장소 목록 */}
      <div className="flex-1 overflow-auto p-4">
        {filteredRepos.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {mode === 'favorites'
              ? '즐겨찾기한 저장소가 없습니다'
              : '검색 결과가 없습니다'}
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepos.map((repo) => (
              <Card key={repo.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {repo.name}
                      </CardTitle>
                      <CardDescription className="text-xs truncate">
                        {repo.full_name}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {repo.private ? (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <Unlock className="w-3 h-3 text-muted-foreground" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleFavorite(repo.id)}
                      >
                        <Star
                          className={cn(
                            'w-3 h-3',
                            favorites.includes(repo.id)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground'
                          )}
                        />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {repo.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {repo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {repo.language && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        {repo.language}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {repo.stargazers_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <GitFork className="w-3 h-3" />
                      {repo.forks_count}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => copyToClipboard(repo.clone_url)}
                    >
                      {copiedUrl === repo.clone_url ? (
                        <Check className="w-3 h-3 mr-1" />
                      ) : (
                        <Copy className="w-3 h-3 mr-1" />
                      )}
                      Clone
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => open(repo.html_url)}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      열기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredRepos.map((repo) => (
              <div
                key={repo.id}
                className="flex items-center gap-3 p-3 rounded-md hover:bg-muted"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => toggleFavorite(repo.id)}
                >
                  <Star
                    className={cn(
                      'w-3 h-3',
                      favorites.includes(repo.id)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    )}
                  />
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {repo.full_name}
                    </span>
                    {repo.private ? (
                      <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <Unlock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {repo.language && <span>{repo.language}</span>}
                    <span>
                      <Star className="w-3 h-3 inline mr-1" />
                      {repo.stargazers_count}
                    </span>
                    <span>업데이트: {formatDate(repo.updated_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(repo.clone_url)}
                    title="Clone URL 복사"
                  >
                    {copiedUrl === repo.clone_url ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => open(repo.html_url)}
                    title="GitHub에서 열기"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

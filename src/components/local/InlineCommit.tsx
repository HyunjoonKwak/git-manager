import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, Upload, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { commit, push, generateCommitMessage } from '@/hooks/useTauriGit'

const COMMIT_PREFIXES = [
  { label: 'feat', desc: '새 기능' },
  { label: 'fix', desc: '버그 수정' },
  { label: 'docs', desc: '문서' },
  { label: 'style', desc: '스타일' },
  { label: 'refactor', desc: '리팩토링' },
  { label: 'test', desc: '테스트' },
  { label: 'chore', desc: '기타' },
]

interface InlineCommitProps {
  repoPath: string
  stagedCount: number
  onCommit: () => void
}

export function InlineCommit({ repoPath, stagedCount, onCommit }: InlineCommitProps) {
  const [message, setMessage] = useState('')
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null)
  const [commitLoading, setCommitLoading] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const fullMessage = selectedPrefix ? `${selectedPrefix}: ${message}` : message
  const canCommit = stagedCount > 0 && message.trim().length > 0

  const handleGenerate = async () => {
    if (stagedCount === 0) {
      toast.error('스테이징된 변경사항이 없습니다')
      return
    }
    setGenerating(true)
    try {
      const generated = await generateCommitMessage(repoPath)
      // Parse prefix if present (e.g., "feat: message" or "feat(scope): message")
      const prefixMatch = generated.match(/^(\w+)(?:\([^)]+\))?:\s*(.*)$/)
      if (prefixMatch) {
        const prefix = prefixMatch[1].toLowerCase()
        const msg = prefixMatch[2]
        if (COMMIT_PREFIXES.some(p => p.label === prefix)) {
          setSelectedPrefix(prefix)
          setMessage(msg)
        } else {
          setSelectedPrefix(null)
          setMessage(generated)
        }
      } else {
        setSelectedPrefix(null)
        setMessage(generated)
      }
      toast.success('커밋 메시지 생성 완료')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  const handleCommit = async (andPush: boolean = false) => {
    if (!canCommit) return

    setCommitLoading(true)
    try {
      const result = await commit(repoPath, fullMessage)
      toast.success(`커밋 완료: ${result?.substring(0, 7)}`)

      if (andPush) {
        setPushLoading(true)
        try {
          await push(repoPath)
          toast.success('Push 완료')
        } catch {
          toast.error('Push 실패')
        }
        setPushLoading(false)
      }

      setMessage('')
      setSelectedPrefix(null)
      onCommit()
    } catch {
      toast.error('커밋에 실패했습니다')
    } finally {
      setCommitLoading(false)
    }
  }

  const handlePrefixClick = (prefix: string) => {
    setSelectedPrefix(selectedPrefix === prefix ? null : prefix)
  }

  const isLoading = commitLoading || pushLoading || generating

  return (
    <Card className="p-2 border-t-2 border-primary/20">
      <div className="space-y-1.5">
        {/* 프리픽스 버튼들 */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground">타입:</span>
          {COMMIT_PREFIXES.map((prefix) => (
            <Badge
              key={prefix.label}
              variant={selectedPrefix === prefix.label ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors text-[10px] px-1.5 py-0 h-5',
                selectedPrefix === prefix.label
                  ? 'bg-primary'
                  : 'hover:bg-muted'
              )}
              onClick={() => handlePrefixClick(prefix.label)}
            >
              {prefix.label}
            </Badge>
          ))}
        </div>

        {/* 메시지 입력 & 버튼 */}
        <div className="flex items-center gap-1.5">
          {/* 프리픽스 표시 */}
          {selectedPrefix && (
            <Badge variant="secondary" className="flex-shrink-0 text-[10px] px-1.5 py-0 h-5">
              {selectedPrefix}:
            </Badge>
          )}

          {/* 메시지 입력 */}
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              stagedCount > 0
                ? `메시지 입력 (${stagedCount}개 staged)`
                : '스테이지된 파일 없음'
            }
            disabled={stagedCount === 0 || isLoading}
            className="flex-1 h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCommit && !isLoading) {
                handleCommit(false)
              }
            }}
          />

          {/* AI 생성 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerate}
            disabled={stagedCount === 0 || isLoading}
            className="h-7 px-2 text-xs"
            title="AI로 커밋 메시지 생성"
          >
            {generating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
          </Button>

          {/* 커밋 버튼 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCommit(false)}
            disabled={!canCommit || isLoading}
            className="h-7 px-2 text-xs"
          >
            {commitLoading && !pushLoading ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Send className="w-3 h-3 mr-1" />
            )}
            커밋
          </Button>

          {/* 커밋 & 푸시 버튼 */}
          <Button
            size="sm"
            onClick={() => handleCommit(true)}
            disabled={!canCommit || isLoading}
            className="h-7 px-2 text-xs"
          >
            {pushLoading ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Upload className="w-3 h-3 mr-1" />
            )}
            Push
          </Button>
        </div>
      </div>
    </Card>
  )
}

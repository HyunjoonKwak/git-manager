import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Github, Loader2, Upload, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { getGitHubToken, createGitHubRepo } from '@/hooks/useGitHub'
import { addRemote, push, getRemotes } from '@/hooks/useTauriGit'

interface PublishToGitHubProps {
  repoPath: string
  repoName: string
  onSuccess?: () => void
}

type Step = 'form' | 'creating' | 'adding-remote' | 'pushing' | 'done' | 'error'

export function PublishToGitHub({ repoPath, repoName, onSuccess }: PublishToGitHubProps) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [hasOrigin, setHasOrigin] = useState(false)

  // Form state
  const [name, setName] = useState(repoName)
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  // Result
  const [repoUrl, setRepoUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (open) {
      checkToken()
      checkRemotes()
      setName(repoName)
      setStep('form')
      setErrorMessage('')
    }
  }, [open, repoName])

  const checkToken = async () => {
    const savedToken = await getGitHubToken()
    setToken(savedToken)
  }

  const checkRemotes = async () => {
    try {
      const remotes = await getRemotes(repoPath)
      setHasOrigin(remotes.some(r => r.name === 'origin'))
    } catch {
      setHasOrigin(false)
    }
  }

  const handlePublish = async () => {
    if (!token) {
      toast.error('GitHub 연결이 필요합니다')
      return
    }

    if (!name.trim()) {
      toast.error('저장소 이름을 입력하세요')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      // Step 1: GitHub 저장소 생성
      setStep('creating')
      const repo = await createGitHubRepo(
        token,
        name.trim(),
        description.trim() || null,
        isPrivate
      )
      setRepoUrl(repo.html_url)

      // Step 2: Remote 추가
      setStep('adding-remote')
      const remoteName = hasOrigin ? 'github' : 'origin'
      await addRemote(repoPath, remoteName, repo.clone_url)

      // Step 3: Push
      setStep('pushing')
      await push(repoPath)

      setStep('done')
      toast.success('GitHub에 게시 완료!')
      onSuccess?.()
    } catch (err) {
      setStep('error')
      setErrorMessage(String(err))
      toast.error(`게시 실패: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setOpen(false)
    }
  }

  const renderStepIndicator = () => {
    const steps = [
      { key: 'creating', label: 'GitHub 저장소 생성' },
      { key: 'adding-remote', label: 'Remote 연결' },
      { key: 'pushing', label: 'Push' },
    ]

    const currentIndex = steps.findIndex(s => s.key === step)

    return (
      <div className="space-y-2 py-4">
        {steps.map((s, index) => {
          const isActive = s.key === step
          const isDone = currentIndex > index || step === 'done'
          const isError = step === 'error' && s.key === steps[currentIndex]?.key

          return (
            <div key={s.key} className="flex items-center gap-3">
              <div className={`
                w-6 h-6 rounded-full flex items-center justify-center text-xs
                ${isDone ? 'bg-green-500 text-white' : ''}
                ${isActive && !isError ? 'bg-primary text-primary-foreground' : ''}
                ${isError ? 'bg-destructive text-destructive-foreground' : ''}
                ${!isDone && !isActive && !isError ? 'bg-muted text-muted-foreground' : ''}
              `}>
                {isDone ? <Check className="w-3 h-3" /> : index + 1}
              </div>
              <span className={`text-sm ${isActive ? 'font-medium' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {isActive && !isError && <Loader2 className="w-4 h-4 animate-spin" />}
              {isError && <AlertCircle className="w-4 h-4 text-destructive" />}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Github className="w-4 h-4" />
          GitHub에 게시
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            GitHub에 게시
          </DialogTitle>
          <DialogDescription>
            로컬 저장소를 새 GitHub 저장소에 게시합니다
          </DialogDescription>
        </DialogHeader>

        {!token ? (
          <div className="py-6 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-4">
              GitHub에 연결되어 있지 않습니다.<br />
              먼저 사이드바에서 GitHub 연결을 해주세요.
            </p>
          </div>
        ) : step === 'form' ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="repo-name">저장소 이름</Label>
              <Input
                id="repo-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-awesome-project"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repo-desc">설명 (선택)</Label>
              <Input
                id="repo-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="프로젝트 설명"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>비공개 저장소</Label>
                <p className="text-xs text-muted-foreground">
                  비공개로 설정하면 본인만 볼 수 있습니다
                </p>
              </div>
              <Switch
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
            {hasOrigin && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                <p className="text-xs text-yellow-600 dark:text-yellow-500">
                  이미 'origin' remote가 있습니다. 'github'라는 이름으로 추가됩니다.
                </p>
              </div>
            )}
          </div>
        ) : step === 'done' ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <p className="font-medium mb-1">게시 완료!</p>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {repoUrl}
            </a>
          </div>
        ) : step === 'error' ? (
          <div className="py-4">
            {renderStepIndicator()}
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md mt-2">
              <p className="text-xs text-destructive">{errorMessage}</p>
            </div>
          </div>
        ) : (
          renderStepIndicator()
        )}

        <DialogFooter>
          {step === 'form' && token && (
            <>
              <Button variant="outline" onClick={handleClose}>
                취소
              </Button>
              <Button onClick={handlePublish} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Upload className="w-4 h-4 mr-2" />
                게시
              </Button>
            </>
          )}
          {(step === 'done' || step === 'error') && (
            <Button onClick={handleClose}>
              닫기
            </Button>
          )}
          {!token && (
            <Button onClick={handleClose}>
              닫기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

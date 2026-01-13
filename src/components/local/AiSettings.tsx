import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Settings, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { getAiConfig, saveAiConfig, type AiConfig } from '@/hooks/useTauriGit'

export function AiSettings() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<AiConfig>({
    provider: 'ollama',
    ollama_url: 'http://localhost:11434',
    ollama_model: 'llama3.2',
    openai_key: '',
    openai_model: 'gpt-4o-mini',
    anthropic_key: '',
    anthropic_model: 'claude-3-5-haiku-latest',
  })

  useEffect(() => {
    if (open) {
      setLoading(true)
      getAiConfig()
        .then(setConfig)
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [open])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveAiConfig(config)
      toast.success('설정 저장됨')
      setOpen(false)
    } catch {
      toast.error('설정 저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="AI 설정">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">AI 커밋 메시지 설정</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Provider 선택 */}
            <div className="space-y-2">
              <Label className="text-xs">AI 제공자</Label>
              <RadioGroup
                value={config.provider}
                onValueChange={(v) => setConfig({ ...config, provider: v as AiConfig['provider'] })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ollama" id="ollama" />
                  <Label htmlFor="ollama" className="text-xs cursor-pointer">Ollama</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="openai" id="openai" />
                  <Label htmlFor="openai" className="text-xs cursor-pointer">OpenAI</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="anthropic" id="anthropic" />
                  <Label htmlFor="anthropic" className="text-xs cursor-pointer">Anthropic</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Ollama 설정 */}
            {config.provider === 'ollama' && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-md">
                <div className="space-y-1">
                  <Label className="text-xs">Ollama URL</Label>
                  <Input
                    value={config.ollama_url}
                    onChange={(e) => setConfig({ ...config, ollama_url: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">모델</Label>
                  <Input
                    value={config.ollama_model}
                    onChange={(e) => setConfig({ ...config, ollama_model: e.target.value })}
                    placeholder="llama3.2"
                    className="h-8 text-xs"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Ollama가 로컬에서 실행 중이어야 합니다
                </p>
              </div>
            )}

            {/* OpenAI 설정 */}
            {config.provider === 'openai' && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-md">
                <div className="space-y-1">
                  <Label className="text-xs">API Key</Label>
                  <Input
                    type="password"
                    value={config.openai_key}
                    onChange={(e) => setConfig({ ...config, openai_key: e.target.value })}
                    placeholder="sk-..."
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">모델</Label>
                  <Input
                    value={config.openai_model}
                    onChange={(e) => setConfig({ ...config, openai_model: e.target.value })}
                    placeholder="gpt-4o-mini"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Anthropic 설정 */}
            {config.provider === 'anthropic' && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-md">
                <div className="space-y-1">
                  <Label className="text-xs">API Key</Label>
                  <Input
                    type="password"
                    value={config.anthropic_key}
                    onChange={(e) => setConfig({ ...config, anthropic_key: e.target.value })}
                    placeholder="sk-ant-..."
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">모델</Label>
                  <Input
                    value={config.anthropic_model}
                    onChange={(e) => setConfig({ ...config, anthropic_model: e.target.value })}
                    placeholder="claude-3-5-haiku-latest"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}

            {/* 저장 버튼 */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-8 text-xs"
            >
              {saving ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Check className="w-3 h-3 mr-1" />
              )}
              저장
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

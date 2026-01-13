use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub provider: String, // "ollama", "openai", "anthropic"
    pub ollama_url: String,
    pub ollama_model: String,
    pub openai_key: String,
    pub openai_model: String,
    pub anthropic_key: String,
    pub anthropic_model: String,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            provider: "ollama".to_string(),
            ollama_url: "http://localhost:11434".to_string(),
            ollama_model: "llama3.2".to_string(),
            openai_key: String::new(),
            openai_model: "gpt-4o-mini".to_string(),
            anthropic_key: String::new(),
            anthropic_model: "claude-3-5-haiku-latest".to_string(),
        }
    }
}

fn get_config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("git-manager");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("ai_config.json")
}

#[tauri::command]
pub fn get_ai_config() -> Result<AiConfig, String> {
    let path = get_config_path();
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(AiConfig::default())
    }
}

#[tauri::command]
pub fn save_ai_config(config: AiConfig) -> Result<(), String> {
    let path = get_config_path();
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

// Ollama API
#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
}

async fn generate_with_ollama(config: &AiConfig, diff: &str) -> Result<String, String> {
    let client = Client::new();
    let prompt = build_prompt(diff);

    let request = OllamaRequest {
        model: config.ollama_model.clone(),
        prompt,
        stream: false,
    };

    let response = client
        .post(format!("{}/api/generate", config.ollama_url))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Ollama 연결 실패: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama 오류: {}", response.status()));
    }

    let result: OllamaResponse = response.json().await.map_err(|e| e.to_string())?;
    Ok(clean_response(&result.response))
}

// OpenAI API
#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    max_tokens: u32,
}

#[derive(Serialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessageContent,
}

#[derive(Deserialize)]
struct OpenAiMessageContent {
    content: String,
}

async fn generate_with_openai(config: &AiConfig, diff: &str) -> Result<String, String> {
    if config.openai_key.is_empty() {
        return Err("OpenAI API 키가 설정되지 않았습니다".to_string());
    }

    let client = Client::new();
    let prompt = build_prompt(diff);

    let request = OpenAiRequest {
        model: config.openai_model.clone(),
        messages: vec![OpenAiMessage {
            role: "user".to_string(),
            content: prompt,
        }],
        max_tokens: 200,
    };

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", config.openai_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("OpenAI 연결 실패: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI 오류 ({}): {}", status, body));
    }

    let result: OpenAiResponse = response.json().await.map_err(|e| e.to_string())?;
    let content = result
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();
    Ok(clean_response(&content))
}

// Anthropic API
#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicMessage>,
}

#[derive(Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Deserialize)]
struct AnthropicContent {
    text: String,
}

async fn generate_with_anthropic(config: &AiConfig, diff: &str) -> Result<String, String> {
    if config.anthropic_key.is_empty() {
        return Err("Anthropic API 키가 설정되지 않았습니다".to_string());
    }

    let client = Client::new();
    let prompt = build_prompt(diff);

    let request = AnthropicRequest {
        model: config.anthropic_model.clone(),
        max_tokens: 200,
        messages: vec![AnthropicMessage {
            role: "user".to_string(),
            content: prompt,
        }],
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &config.anthropic_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Anthropic 연결 실패: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic 오류 ({}): {}", status, body));
    }

    let result: AnthropicResponse = response.json().await.map_err(|e| e.to_string())?;
    let text = result
        .content
        .first()
        .map(|c| c.text.clone())
        .unwrap_or_default();
    Ok(clean_response(&text))
}

fn build_prompt(diff: &str) -> String {
    // Truncate diff if too long
    let truncated_diff = if diff.len() > 8000 {
        format!("{}...(truncated)", &diff[..8000])
    } else {
        diff.to_string()
    };

    format!(
        r#"Analyze the following git diff and generate a concise commit message.

Rules:
- Use conventional commit format: type(scope): description
- Types: feat, fix, docs, style, refactor, test, chore
- Keep the message under 72 characters
- Focus on WHAT changed and WHY, not HOW
- Write in English
- Return ONLY the commit message, nothing else

Git diff:
```
{}
```

Commit message:"#,
        truncated_diff
    )
}

fn clean_response(response: &str) -> String {
    response
        .trim()
        .trim_matches('"')
        .trim_matches('`')
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_string()
}

#[tauri::command]
pub async fn generate_commit_message(path: String) -> Result<String, String> {
    // Get staged diff
    let output = std::process::Command::new("git")
        .args(["diff", "--cached"])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    let diff = String::from_utf8_lossy(&output.stdout).to_string();

    if diff.trim().is_empty() {
        return Err("스테이징된 변경사항이 없습니다".to_string());
    }

    let config = get_ai_config()?;

    match config.provider.as_str() {
        "ollama" => generate_with_ollama(&config, &diff).await,
        "openai" => generate_with_openai(&config, &diff).await,
        "anthropic" => generate_with_anthropic(&config, &diff).await,
        _ => Err("알 수 없는 AI 제공자입니다".to_string()),
    }
}

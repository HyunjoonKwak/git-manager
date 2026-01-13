use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubRepo {
    pub id: i64,
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub html_url: String,
    pub clone_url: String,
    pub ssh_url: String,
    pub private: bool,
    pub fork: bool,
    pub stargazers_count: i32,
    pub watchers_count: i32,
    pub forks_count: i32,
    pub language: Option<String>,
    pub default_branch: String,
    pub updated_at: String,
    pub pushed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub id: i64,
    pub avatar_url: String,
    pub html_url: String,
    pub name: Option<String>,
    pub bio: Option<String>,
    pub public_repos: i32,
    pub followers: i32,
    pub following: i32,
}

fn get_config_dir() -> PathBuf {
    let home = dirs::home_dir().expect("홈 디렉토리를 찾을 수 없습니다");
    let config_dir = home.join(".git-manager");
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).expect("설정 디렉토리 생성 실패");
    }
    config_dir
}

fn get_token_path() -> PathBuf {
    get_config_dir().join("github_token")
}

fn get_favorites_path() -> PathBuf {
    get_config_dir().join("github_favorites.json")
}

#[tauri::command]
pub fn save_github_token(token: String) -> Result<(), String> {
    let path = get_token_path();
    fs::write(&path, &token).map_err(|e| format!("토큰 저장 실패: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_github_token() -> Result<Option<String>, String> {
    let path = get_token_path();
    if path.exists() {
        let token = fs::read_to_string(&path).map_err(|e| format!("토큰 읽기 실패: {}", e))?;
        if token.trim().is_empty() {
            Ok(None)
        } else {
            Ok(Some(token.trim().to_string()))
        }
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn delete_github_token() -> Result<(), String> {
    let path = get_token_path();
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("토큰 삭제 실패: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn fetch_github_user(token: String) -> Result<GitHubUser, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "git-manager-tauri")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("API 요청 실패: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API 오류: {}", response.status()));
    }

    let user: GitHubUser = response
        .json()
        .await
        .map_err(|e| format!("응답 파싱 실패: {}", e))?;

    Ok(user)
}

#[tauri::command]
pub async fn fetch_github_repos(token: String) -> Result<Vec<GitHubRepo>, String> {
    let client = reqwest::Client::new();
    let mut all_repos: Vec<GitHubRepo> = Vec::new();
    let mut page = 1;
    let per_page = 100;

    loop {
        let response = client
            .get("https://api.github.com/user/repos")
            .query(&[
                ("per_page", per_page.to_string()),
                ("page", page.to_string()),
                ("sort", "updated".to_string()),
                ("affiliation", "owner,collaborator,organization_member".to_string()),
            ])
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "git-manager-tauri")
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| format!("API 요청 실패: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("GitHub API 오류: {}", response.status()));
        }

        let repos: Vec<GitHubRepo> = response
            .json()
            .await
            .map_err(|e| format!("응답 파싱 실패: {}", e))?;

        let repos_count = repos.len();
        all_repos.extend(repos);

        if repos_count < per_page {
            break;
        }

        page += 1;

        if page > 10 {
            break;
        }
    }

    Ok(all_repos)
}

#[tauri::command]
pub fn get_github_favorites() -> Result<Vec<i64>, String> {
    let path = get_favorites_path();
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("즐겨찾기 읽기 실패: {}", e))?;
        let favorites: Vec<i64> = serde_json::from_str(&content)
            .map_err(|e| format!("즐겨찾기 파싱 실패: {}", e))?;
        Ok(favorites)
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn add_github_favorite(repo_id: i64) -> Result<(), String> {
    let mut favorites = get_github_favorites().unwrap_or_default();
    if !favorites.contains(&repo_id) {
        favorites.push(repo_id);
        let path = get_favorites_path();
        let content = serde_json::to_string(&favorites)
            .map_err(|e| format!("즐겨찾기 직렬화 실패: {}", e))?;
        fs::write(&path, content)
            .map_err(|e| format!("즐겨찾기 저장 실패: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn remove_github_favorite(repo_id: i64) -> Result<(), String> {
    let mut favorites = get_github_favorites().unwrap_or_default();
    favorites.retain(|&id| id != repo_id);
    let path = get_favorites_path();
    let content = serde_json::to_string(&favorites)
        .map_err(|e| format!("즐겨찾기 직렬화 실패: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("즐겨찾기 저장 실패: {}", e))?;
    Ok(())
}

#[derive(Debug, Serialize)]
struct CreateRepoRequest {
    name: String,
    description: Option<String>,
    private: bool,
    auto_init: bool,
}

#[tauri::command]
pub async fn create_github_repo(
    token: String,
    name: String,
    description: Option<String>,
    private: bool,
) -> Result<GitHubRepo, String> {
    let client = reqwest::Client::new();

    let request_body = CreateRepoRequest {
        name,
        description,
        private,
        auto_init: false, // 로컬 저장소를 push할 것이므로 초기화하지 않음
    };

    let response = client
        .post("https://api.github.com/user/repos")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "git-manager-tauri")
        .header("Accept", "application/vnd.github+json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("API 요청 실패: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("GitHub API 오류 ({}): {}", status, error_text));
    }

    let repo: GitHubRepo = response
        .json()
        .await
        .map_err(|e| format!("응답 파싱 실패: {}", e))?;

    Ok(repo)
}

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher, Event};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

type WatcherMap = Arc<Mutex<HashMap<String, RecommendedWatcher>>>;

lazy_static::lazy_static! {
    static ref WATCHERS: WatcherMap = Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Clone, serde::Serialize)]
pub struct GitChangeEvent {
    pub repo_path: String,
    pub change_type: String,
}

#[tauri::command]
pub fn watch_repo(app: AppHandle, path: String) -> Result<(), String> {
    let mut watchers = WATCHERS.lock().map_err(|e| e.to_string())?;

    // 이미 감시 중이면 스킵
    if watchers.contains_key(&path) {
        return Ok(());
    }

    let repo_path = path.clone();
    let app_handle = app.clone();
    let last_emit = Arc::new(Mutex::new(Instant::now()));

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                // 불필요한 파일 변경 필터링
                let dominated_paths: Vec<_> = event.paths.iter()
                    .filter(|p| {
                        let path_str = p.to_string_lossy();
                        // node_modules, dist, target 등 제외
                        if path_str.contains("node_modules")
                            || path_str.contains("/dist/")
                            || path_str.contains("/target/")
                            || path_str.contains(".DS_Store")
                        {
                            return false;
                        }
                        // .git 폴더 내부 변경 제외 (git status 호출 시 index 파일 수정으로 인한 무한 루프 방지)
                        if path_str.contains("/.git/") || path_str.contains("\\.git\\") {
                            return false;
                        }
                        // .lock 등 임시 파일 제외
                        if path_str.contains(".lock") {
                            return false;
                        }
                        true
                    })
                    .collect();

                if !dominated_paths.is_empty() {
                    // 디바운싱: 1초 이내 중복 이벤트 무시
                    let mut last = last_emit.lock().unwrap();
                    if last.elapsed() > Duration::from_millis(1000) {
                        *last = Instant::now();

                        let change_type = match event.kind {
                            notify::EventKind::Create(_) => "create",
                            notify::EventKind::Modify(_) => "modify",
                            notify::EventKind::Remove(_) => "remove",
                            _ => "other",
                        };

                        let _ = app_handle.emit("git-changed", GitChangeEvent {
                            repo_path: repo_path.clone(),
                            change_type: change_type.to_string(),
                        });
                    }
                }
            }
        },
        Config::default().with_poll_interval(Duration::from_secs(2)),
    ).map_err(|e| e.to_string())?;

    // .git 폴더와 작업 디렉토리 모두 감시
    let watch_path = PathBuf::from(&path);
    watcher.watch(&watch_path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    watchers.insert(path, watcher);

    Ok(())
}

#[tauri::command]
pub fn unwatch_repo(path: String) -> Result<(), String> {
    let mut watchers = WATCHERS.lock().map_err(|e| e.to_string())?;
    watchers.remove(&path);
    Ok(())
}

#[tauri::command]
pub fn unwatch_all() -> Result<(), String> {
    let mut watchers = WATCHERS.lock().map_err(|e| e.to_string())?;
    watchers.clear();
    Ok(())
}

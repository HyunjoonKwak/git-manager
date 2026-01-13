mod ai;
mod git;
mod github;
mod watcher;

use ai::*;
use git::*;
use github::*;
use watcher::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_repo_info,
            get_status,
            stage_file,
            unstage_file,
            stage_all,
            commit,
            push,
            pull,
            fetch_remote,
            get_branches,
            checkout_branch,
            get_log,
            get_graph_log,
            get_diff,
            get_staged_diff,
            get_commit_diff,
            discard_changes,
            checkout_commit,
            create_branch_at,
            reset_to_commit,
            create_tag,
            cherry_pick,
            revert_commit,
            stash_save,
            stash_pop,
            stash_list,
            stash_drop,
            stash_apply,
            delete_branch,
            rename_branch,
            merge_branch,
            rebase_onto,
            get_remote_status,
            // 원격 저장소 관리
            get_remotes,
            add_remote,
            remove_remote,
            set_remote_url,
            rename_remote,
            get_remote_branches,
            checkout_remote_branch,
            delete_remote_branch,
            prune_remote,
            fetch_from_remote,
            // 파일 감시
            watch_repo,
            unwatch_repo,
            unwatch_all,
            // AI 커밋 메시지 생성
            get_ai_config,
            save_ai_config,
            generate_commit_message,
            // 저장소 초기화 및 복제
            init_repo,
            clone_repo,
            // GitHub API
            save_github_token,
            get_github_token,
            delete_github_token,
            fetch_github_user,
            fetch_github_repos,
            get_github_favorites,
            add_github_favorite,
            remove_github_favorite,
            create_github_repo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

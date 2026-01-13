use git2::{Repository, StatusOptions, BranchType, build::RepoBuilder};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct RepoInfo {
    pub path: String,
    pub name: String,
    pub current_branch: String,
    pub branches: Vec<BranchInfo>,
    pub status: Vec<FileStatus>,
    pub remotes: Vec<String>,
    pub last_commit: Option<CommitInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub current: bool,
    pub commit: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitInfo {
    pub hash: String,
    pub hash_short: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphCommit {
    pub hash: String,
    pub hash_short: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub date: String,
    pub parents: Vec<String>,
    pub branches: Vec<String>,
    pub tags: Vec<String>,
    pub column: usize,
    pub color: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoteStatus {
    pub ahead: usize,
    pub behind: usize,
    pub has_remote: bool,
    pub remote: Option<String>,
}

fn map_git_error(e: git2::Error) -> String {
    e.message().to_string()
}

#[tauri::command]
pub fn get_repo_info(path: &str) -> Result<RepoInfo, String> {
    let repo = Repository::open(path).map_err(map_git_error)?;

    let name = Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // Current branch (빈 저장소는 HEAD가 없을 수 있음)
    let current_branch = match repo.head() {
        Ok(head) => head.shorthand().unwrap_or("HEAD").to_string(),
        Err(_) => "(no branch)".to_string(), // 빈 저장소
    };

    // Branches
    let branches = get_branches_internal(&repo).unwrap_or_default();

    // Status
    let status = get_status_internal(&repo)?;

    // Remotes
    let remotes = repo
        .remotes()
        .map_err(map_git_error)?
        .iter()
        .filter_map(|r| r.map(|s| s.to_string()))
        .collect();

    // Last commit
    let last_commit = get_last_commit(&repo)?;

    Ok(RepoInfo {
        path: path.to_string(),
        name,
        current_branch,
        branches,
        status,
        remotes,
        last_commit,
    })
}

fn get_last_commit(repo: &Repository) -> Result<Option<CommitInfo>, String> {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok(None),
    };

    let commit = head.peel_to_commit().map_err(map_git_error)?;
    let time = commit.time();
    let datetime = chrono_from_git_time(time.seconds());

    let author = commit.author();
    let author_name = author.name().unwrap_or("").to_string();
    let author_email = author.email().unwrap_or("").to_string();

    Ok(Some(CommitInfo {
        hash: commit.id().to_string(),
        hash_short: commit.id().to_string()[..7].to_string(),
        message: commit.summary().unwrap_or("").to_string(),
        author: author_name,
        email: author_email,
        date: datetime,
    }))
}

fn chrono_from_git_time(seconds: i64) -> String {
    use std::time::{UNIX_EPOCH, Duration};
    let d = UNIX_EPOCH + Duration::from_secs(seconds as u64);
    format!("{:?}", d)
}

fn get_branches_internal(repo: &Repository) -> Result<Vec<BranchInfo>, String> {
    let mut branches = Vec::new();

    let head = repo.head().ok();
    let head_name = head.as_ref().and_then(|h| h.shorthand().map(|s| s.to_string()));

    for branch in repo.branches(Some(BranchType::Local)).map_err(map_git_error)? {
        let (branch, _) = branch.map_err(map_git_error)?;
        let name = branch.name().map_err(map_git_error)?.unwrap_or("").to_string();
        let commit = branch.get().peel_to_commit().map_err(map_git_error)?;

        branches.push(BranchInfo {
            name: name.clone(),
            current: head_name.as_ref() == Some(&name),
            commit: commit.id().to_string()[..7].to_string(),
        });
    }

    Ok(branches)
}

fn get_status_internal(repo: &Repository) -> Result<Vec<FileStatus>, String> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut opts)).map_err(map_git_error)?;
    let mut files = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        let (status_str, staged) = if status.is_index_new() {
            ("added", true)
        } else if status.is_index_modified() {
            ("modified", true)
        } else if status.is_index_deleted() {
            ("deleted", true)
        } else if status.is_index_renamed() {
            ("renamed", true)
        } else if status.is_wt_new() {
            ("untracked", false)
        } else if status.is_wt_modified() {
            ("modified", false)
        } else if status.is_wt_deleted() {
            ("deleted", false)
        } else if status.is_wt_renamed() {
            ("renamed", false)
        } else {
            continue;
        };

        files.push(FileStatus {
            path,
            status: status_str.to_string(),
            staged,
        });
    }

    Ok(files)
}

#[tauri::command]
pub fn get_status(path: &str) -> Result<Vec<FileStatus>, String> {
    let repo = Repository::open(path).map_err(map_git_error)?;
    get_status_internal(&repo)
}

#[tauri::command]
pub fn stage_file(path: &str, file_path: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(map_git_error)?;
    let mut index = repo.index().map_err(map_git_error)?;
    index.add_path(Path::new(file_path)).map_err(map_git_error)?;
    index.write().map_err(map_git_error)?;
    Ok(())
}

#[tauri::command]
pub fn unstage_file(path: &str, file_path: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(map_git_error)?;
    let head = repo.head().map_err(map_git_error)?;
    let head_commit = head.peel_to_commit().map_err(map_git_error)?;

    repo.reset_default(Some(&head_commit.into_object()), &[Path::new(file_path)])
        .map_err(map_git_error)?;
    Ok(())
}

#[tauri::command]
pub fn stage_all(path: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(map_git_error)?;
    let mut index = repo.index().map_err(map_git_error)?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(map_git_error)?;
    index.write().map_err(map_git_error)?;
    Ok(())
}

#[tauri::command]
pub fn commit(path: &str, message: &str) -> Result<String, String> {
    let repo = Repository::open(path).map_err(map_git_error)?;
    let mut index = repo.index().map_err(map_git_error)?;
    let tree_id = index.write_tree().map_err(map_git_error)?;
    let tree = repo.find_tree(tree_id).map_err(map_git_error)?;

    let sig = repo.signature().map_err(map_git_error)?;

    let parent = match repo.head() {
        Ok(head) => Some(head.peel_to_commit().map_err(map_git_error)?),
        Err(_) => None,
    };

    let parents: Vec<&git2::Commit> = parent.iter().collect();

    let commit_id = repo
        .commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)
        .map_err(map_git_error)?;

    Ok(commit_id.to_string()[..7].to_string())
}

#[tauri::command]
pub fn push(path: &str) -> Result<(), String> {
    // git2의 push는 인증 처리가 복잡하므로 git CLI 사용
    use std::process::Command;

    let output = Command::new("git")
        .args(["push"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn push_to_remote(path: &str, remote: &str, branch: &str) -> Result<(), String> {
    // 처음 push할 때 upstream 설정과 함께 push
    use std::process::Command;

    let output = Command::new("git")
        .args(["push", "-u", remote, branch])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn pull(path: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["pull"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn fetch_remote(path: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["fetch", "--all"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn get_branches(path: &str) -> Result<Vec<BranchInfo>, String> {
    let repo = Repository::open(path).map_err(map_git_error)?;
    get_branches_internal(&repo)
}

#[tauri::command]
pub fn checkout_branch(path: &str, branch_name: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(map_git_error)?;

    let (object, reference) = repo
        .revparse_ext(branch_name)
        .map_err(map_git_error)?;

    repo.checkout_tree(&object, None).map_err(map_git_error)?;

    match reference {
        Some(gref) => repo.set_head(gref.name().unwrap()).map_err(map_git_error)?,
        None => repo.set_head_detached(object.id()).map_err(map_git_error)?,
    }

    Ok(())
}

#[tauri::command]
pub fn get_log(path: &str, max_count: usize) -> Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(path).map_err(map_git_error)?;
    let mut revwalk = repo.revwalk().map_err(map_git_error)?;
    revwalk.push_head().map_err(map_git_error)?;

    let mut commits = Vec::new();

    for (i, oid) in revwalk.enumerate() {
        if i >= max_count {
            break;
        }

        let oid = oid.map_err(map_git_error)?;
        let commit = repo.find_commit(oid).map_err(map_git_error)?;
        let time = commit.time();

        commits.push(CommitInfo {
            hash: commit.id().to_string(),
            hash_short: commit.id().to_string()[..7].to_string(),
            message: commit.summary().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            date: chrono_from_git_time(time.seconds()),
        });
    }

    Ok(commits)
}

#[tauri::command]
pub fn get_graph_log(path: &str, max_count: usize) -> Result<Vec<GraphCommit>, String> {
    let repo = Repository::open(path).map_err(map_git_error)?;
    let mut revwalk = repo.revwalk().map_err(map_git_error)?;
    revwalk.set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL).map_err(map_git_error)?;
    revwalk.push_head().map_err(map_git_error)?;

    // Also push all branches
    for branch in repo.branches(None).map_err(map_git_error)? {
        let (branch, _) = branch.map_err(map_git_error)?;
        if let Ok(reference) = branch.get().resolve() {
            if let Some(oid) = reference.target() {
                let _ = revwalk.push(oid);
            }
        }
    }

    // Collect branch names by commit
    let mut branch_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for branch in repo.branches(None).map_err(map_git_error)? {
        let (branch, branch_type) = branch.map_err(map_git_error)?;
        let name = branch.name().map_err(map_git_error)?.unwrap_or("").to_string();
        if let Ok(reference) = branch.get().resolve() {
            if let Some(oid) = reference.target() {
                let prefix = if branch_type == BranchType::Remote { "origin/" } else { "" };
                branch_map
                    .entry(oid.to_string())
                    .or_default()
                    .push(format!("{}{}", prefix, name.replace("origin/", "")));
            }
        }
    }

    // Collect tags by commit
    let mut tag_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for tag_name in repo.tag_names(None).map_err(map_git_error)?.iter().flatten() {
        if let Ok(reference) = repo.find_reference(&format!("refs/tags/{}", tag_name)) {
            if let Some(oid) = reference.target() {
                tag_map
                    .entry(oid.to_string())
                    .or_default()
                    .push(tag_name.to_string());
            }
        }
    }

    let mut commits = Vec::new();
    let mut column_map: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut active_columns: Vec<Option<String>> = Vec::new();

    for (i, oid) in revwalk.enumerate() {
        if i >= max_count {
            break;
        }

        let oid = oid.map_err(map_git_error)?;
        let commit = repo.find_commit(oid).map_err(map_git_error)?;
        let time = commit.time();
        let hash = commit.id().to_string();

        // Determine column
        let column = if let Some(&col) = column_map.get(&hash) {
            col
        } else {
            let col = active_columns.iter().position(|c| c.is_none()).unwrap_or(active_columns.len());
            if col >= active_columns.len() {
                active_columns.push(Some(hash.clone()));
            } else {
                active_columns[col] = Some(hash.clone());
            }
            col
        };

        // Update column map for parents
        let parents: Vec<String> = commit.parents().map(|p| p.id().to_string()).collect();
        for (pi, parent_hash) in parents.iter().enumerate() {
            if !column_map.contains_key(parent_hash) {
                if pi == 0 {
                    column_map.insert(parent_hash.clone(), column);
                } else {
                    let new_col = active_columns.iter().position(|c| c.is_none()).unwrap_or(active_columns.len());
                    if new_col >= active_columns.len() {
                        active_columns.push(Some(parent_hash.clone()));
                    } else {
                        active_columns[new_col] = Some(parent_hash.clone());
                    }
                    column_map.insert(parent_hash.clone(), new_col);
                }
            }
        }

        // Free up current column if no more parents use it
        if parents.is_empty() || !parents.iter().any(|p| column_map.get(p) == Some(&column)) {
            if column < active_columns.len() {
                active_columns[column] = None;
            }
        }

        let branches = branch_map.get(&hash).cloned().unwrap_or_default();
        let tags = tag_map.get(&hash).cloned().unwrap_or_default();

        commits.push(GraphCommit {
            hash: hash.clone(),
            hash_short: hash[..7].to_string(),
            message: commit.summary().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            date: chrono_from_git_time(time.seconds()),
            parents,
            branches,
            tags,
            column,
            color: column % 8,
        });
    }

    Ok(commits)
}

#[tauri::command]
pub fn get_diff(path: &str, file_path: Option<&str>) -> Result<String, String> {
    use std::process::Command;

    let mut args = vec!["diff"];
    if let Some(fp) = file_path {
        args.push("--");
        args.push(fp);
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub fn get_staged_diff(path: &str) -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["diff", "--cached"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub fn get_commit_diff(path: &str, commit_hash: &str) -> Result<String, String> {
    use std::process::Command;

    // Show diff for this commit (compare with parent)
    let output = Command::new("git")
        .args(["show", commit_hash, "--format=", "--stat", "--patch"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub fn discard_changes(path: &str, file_path: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["checkout", "--", file_path])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn checkout_commit(path: &str, commit_hash: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["checkout", commit_hash])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn create_branch_at(path: &str, branch_name: &str, commit_hash: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["branch", branch_name, commit_hash])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn reset_to_commit(path: &str, commit_hash: &str, mode: &str) -> Result<(), String> {
    use std::process::Command;

    let mode_flag = match mode {
        "soft" => "--soft",
        "hard" => "--hard",
        _ => "--mixed",
    };

    let output = Command::new("git")
        .args(["reset", mode_flag, commit_hash])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn create_tag(path: &str, tag_name: &str, commit_hash: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["tag", tag_name, commit_hash])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn cherry_pick(path: &str, commit_hash: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["cherry-pick", commit_hash])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn revert_commit(path: &str, commit_hash: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["revert", "--no-edit", commit_hash])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn stash_save(path: &str, message: Option<&str>) -> Result<(), String> {
    use std::process::Command;

    let mut args = vec!["stash", "push"];
    if let Some(msg) = message {
        args.push("-m");
        args.push(msg);
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn stash_pop(path: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["stash", "pop"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn stash_list(path: &str) -> Result<Vec<String>, String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["stash", "list"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stashes: Vec<String> = stdout.lines().map(|s| s.to_string()).collect();

    Ok(stashes)
}

#[tauri::command]
pub fn stash_drop(path: &str, index: usize) -> Result<(), String> {
    use std::process::Command;

    let stash_ref = format!("stash@{{{}}}", index);
    let output = Command::new("git")
        .args(["stash", "drop", &stash_ref])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn stash_apply(path: &str, index: usize) -> Result<(), String> {
    use std::process::Command;

    let stash_ref = format!("stash@{{{}}}", index);
    let output = Command::new("git")
        .args(["stash", "apply", &stash_ref])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn delete_branch(path: &str, branch_name: &str, force: bool) -> Result<(), String> {
    use std::process::Command;

    let flag = if force { "-D" } else { "-d" };
    let output = Command::new("git")
        .args(["branch", flag, branch_name])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn rename_branch(path: &str, old_name: &str, new_name: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["branch", "-m", old_name, new_name])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn merge_branch(path: &str, branch_name: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["merge", branch_name])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn rebase_onto(path: &str, branch_name: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["rebase", branch_name])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn get_remote_status(path: &str) -> Result<RemoteStatus, String> {
    use std::process::Command;

    // First fetch to get latest remote info
    let _ = Command::new("git")
        .args(["fetch", "--all"])
        .current_dir(path)
        .output();

    let output = Command::new("git")
        .args(["rev-list", "--left-right", "--count", "@{upstream}...HEAD"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(RemoteStatus {
            ahead: 0,
            behind: 0,
            has_remote: false,
            remote: None,
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = stdout.trim().split_whitespace().collect();

    let (behind, ahead) = if parts.len() == 2 {
        (
            parts[0].parse().unwrap_or(0),
            parts[1].parse().unwrap_or(0),
        )
    } else {
        (0, 0)
    };

    // Get remote name
    let remote_output = Command::new("git")
        .args(["remote"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    let remote = String::from_utf8_lossy(&remote_output.stdout)
        .lines()
        .next()
        .map(|s| s.to_string());

    Ok(RemoteStatus {
        ahead,
        behind,
        has_remote: remote.is_some(),
        remote,
    })
}

// ============ 원격 저장소 관리 기능 ============

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoteInfo {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoteBranchInfo {
    pub name: String,
    pub remote: String,
    pub commit: String,
    pub is_tracking: bool,
}

/// 모든 원격 저장소 목록 가져오기
#[tauri::command]
pub fn get_remotes(path: &str) -> Result<Vec<RemoteInfo>, String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["remote", "-v"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut remotes: std::collections::HashMap<String, RemoteInfo> = std::collections::HashMap::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            let name = parts[0].to_string();
            let url = parts[1].to_string();
            let url_type = parts[2].trim_matches(|c| c == '(' || c == ')');

            let entry = remotes.entry(name.clone()).or_insert(RemoteInfo {
                name: name.clone(),
                fetch_url: String::new(),
                push_url: String::new(),
            });

            if url_type == "fetch" {
                entry.fetch_url = url;
            } else if url_type == "push" {
                entry.push_url = url;
            }
        }
    }

    Ok(remotes.into_values().collect())
}

/// 원격 저장소 추가
#[tauri::command]
pub fn add_remote(path: &str, name: &str, url: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["remote", "add", name, url])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

/// 원격 저장소 삭제
#[tauri::command]
pub fn remove_remote(path: &str, name: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["remote", "remove", name])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

/// 원격 저장소 URL 변경
#[tauri::command]
pub fn set_remote_url(path: &str, name: &str, url: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["remote", "set-url", name, url])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

/// 원격 저장소 이름 변경
#[tauri::command]
pub fn rename_remote(path: &str, old_name: &str, new_name: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["remote", "rename", old_name, new_name])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

/// 원격 브랜치 목록 가져오기
#[tauri::command]
pub fn get_remote_branches(path: &str) -> Result<Vec<RemoteBranchInfo>, String> {
    let repo = Repository::open(path).map_err(map_git_error)?;
    let mut branches = Vec::new();

    // Get current branch's tracking branch
    let tracking_branch = repo.head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .and_then(|local_name| {
            repo.find_branch(&local_name, BranchType::Local)
                .ok()
                .and_then(|b| b.upstream().ok())
                .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()))
        });

    for branch in repo.branches(Some(BranchType::Remote)).map_err(map_git_error)? {
        let (branch, _) = branch.map_err(map_git_error)?;
        let name = branch.name().map_err(map_git_error)?.unwrap_or("").to_string();

        // Skip HEAD references
        if name.ends_with("/HEAD") {
            continue;
        }

        let commit = branch
            .get()
            .peel_to_commit()
            .map(|c| c.id().to_string()[..7].to_string())
            .unwrap_or_default();

        // Parse remote name from branch name (e.g., "origin/main" -> "origin")
        let remote = name.split('/').next().unwrap_or("").to_string();
        let is_tracking = tracking_branch.as_ref() == Some(&name);

        branches.push(RemoteBranchInfo {
            name: name.clone(),
            remote,
            commit,
            is_tracking,
        });
    }

    Ok(branches)
}

/// 원격 브랜치를 로컬로 체크아웃
#[tauri::command]
pub fn checkout_remote_branch(path: &str, remote_branch: &str, local_name: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["checkout", "-b", local_name, "--track", remote_branch])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

/// 원격 브랜치 삭제
#[tauri::command]
pub fn delete_remote_branch(path: &str, remote: &str, branch: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["push", remote, "--delete", branch])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

/// Prune (정리) - 삭제된 원격 브랜치 참조 제거
#[tauri::command]
pub fn prune_remote(path: &str, remote: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["remote", "prune", remote])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

/// 특정 원격 저장소에서 fetch
#[tauri::command]
pub fn fetch_from_remote(path: &str, remote: &str) -> Result<(), String> {
    let output = Command::new("git")
        .args(["fetch", remote])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

// ============ 저장소 초기화 및 복제 ============

/// 새 Git 저장소 초기화
#[tauri::command]
pub fn init_repo(path: &str) -> Result<String, String> {
    println!("[init_repo] Initializing: {}", path);
    match Repository::init(path) {
        Ok(repo) => {
            let git_dir = repo.path().to_string_lossy().to_string();
            println!("[init_repo] Success: {}", git_dir);
            Ok(git_dir)
        }
        Err(e) => {
            println!("[init_repo] Error: {}", e.message());
            Err(e.message().to_string())
        }
    }
}

/// 원격 저장소 복제
#[tauri::command]
pub fn clone_repo(url: &str, path: &str) -> Result<(), String> {
    // git2의 clone은 인증 처리가 복잡하므로 git CLI 사용
    let output = Command::new("git")
        .args(["clone", url, path])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

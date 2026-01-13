# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Git Manager는 로컬 Git 저장소를 관리하기 위한 Tauri 2.0 기반 데스크톱 애플리케이션입니다. React 프론트엔드와 Rust 백엔드로 구성되어 있습니다.

## Development Commands

```bash
# 개발 서버 실행 (프론트엔드 + Tauri)
npm run tauri dev

# 프론트엔드만 실행
npm run dev

# 프로덕션 빌드
npm run tauri build

# TypeScript 타입 체크
npm run build
```

## Architecture

### Frontend (src/)
- **React 19 + TypeScript + Vite**: 프론트엔드 스택
- **Tailwind CSS 4**: 스타일링
- **Zustand**: 상태 관리 (`src/stores/useLocalReposStore.ts`)
- **Radix UI**: UI 컴포넌트 기반

주요 파일:
- `src/App.tsx`: 메인 애플리케이션 레이아웃 및 저장소 선택 로직
- `src/hooks/useTauriGit.ts`: Tauri invoke 래퍼 함수들 (프론트엔드-백엔드 통신)
- `src/components/local/`: Git 관련 UI 컴포넌트들

### Backend (src-tauri/)
- **Tauri 2.0**: 데스크톱 앱 프레임워크
- **git2**: Git 저장소 조작 (libgit2 바인딩)
- **notify**: 파일 시스템 감시

모듈 구조:
- `src/lib.rs`: Tauri 명령 핸들러 등록
- `src/git.rs`: Git 작업 구현 (stage, commit, push, pull, branch 등)
- `src/watcher.rs`: 파일 변경 감시 및 `git-changed` 이벤트 발행
- `src/ai.rs`: AI 커밋 메시지 생성 (Ollama, OpenAI, Anthropic 지원)

### Frontend-Backend Communication
프론트엔드에서 `@tauri-apps/api/core`의 `invoke()`를 사용하여 Rust 명령 호출. 파일 변경 시 백엔드에서 `git-changed` 이벤트를 emit하고 프론트엔드에서 `@tauri-apps/api/event`의 `listen()`으로 수신.

## Key Patterns

### Git 작업 추가 시
1. `src-tauri/src/git.rs`에 `#[tauri::command]` 함수 추가
2. `src-tauri/src/lib.rs`의 `invoke_handler!`에 함수 등록
3. `src/hooks/useTauriGit.ts`에 TypeScript 래퍼 함수 추가

### UI 컴포넌트
shadcn/ui 패턴 사용. `src/components/ui/`에 기본 컴포넌트, `src/components/local/`에 Git 관련 컴포넌트 배치.

### 인증이 필요한 Git 작업
git2의 인증 처리가 복잡하여 `push`, `pull`, `fetch` 등은 `std::process::Command`로 git CLI 직접 호출.

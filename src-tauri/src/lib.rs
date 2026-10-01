use std::sync::Mutex;
use tauri::Emitter;

/// 冷启动（双击文件唤起应用）时暂存的待打开文件。
/// 用进程级全局静态：从进程启动那一刻就存在，避免 app.manage 与
/// macOS Opened 事件的时序竞争（实测 Opened 可能在 setup 完成前到达）。
static PENDING: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// 前端启动时/启动后主动拉取暂存文件（一次性取空）
#[tauri::command]
fn take_pending_files() -> Vec<String> {
    std::mem::take(&mut *PENDING.lock().unwrap())
}

/// 暂存 + 立即广播（前端未就绪/晚就绪时靠 take_pending_files 轮询兜底）
fn push_files(app: &tauri::AppHandle, files: Vec<String>) {
    if files.is_empty() {
        return;
    }
    eprintln!("[md66] 收到打开文件请求: {files:?}");
    PENDING.lock().unwrap().extend(files.iter().cloned());
    // 定向主窗口（裸 emit 广播在部分场景未送达 webview）
    let _ = app.emit_to("main", "file-open", &files);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![take_pending_files])
        .setup(|_app| {
            // Windows/Linux: 启动时文件路径作为 CLI 参数传入
            let args: Vec<String> = std::env::args().skip(1).collect();
            let files: Vec<String> = args
                .into_iter()
                .filter(|a| !a.starts_with('-') && std::path::Path::new(a).exists())
                .collect();
            if !files.is_empty() {
                eprintln!("[md66] CLI 参数文件: {files:?}");
                PENDING.lock().unwrap().extend(files.iter().cloned());
            }
            Ok(())
        });

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // macOS: 双击文件（冷启动与已运行）→ RunEvent::Opened
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Opened { urls } = event {
            let files: Vec<String> = urls
                .into_iter()
                .filter_map(|u| {
                    u.to_file_path().ok().and_then(|p| {
                        if p.exists() {
                            Some(p.to_string_lossy().to_string())
                        } else {
                            None
                        }
                    })
                })
                .collect();
            push_files(app_handle, files);
        }
    });
}

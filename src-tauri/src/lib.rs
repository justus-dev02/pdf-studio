pub mod commands;
pub mod engine;
pub mod error;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::native_get_engine_info,
            commands::native_parallel_search,
            commands::native_analyze_nlp,
            commands::native_analyze_pdf_structure
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

//! Tauri IPC commands.
//!
//! All CPU-bound work runs on the blocking thread pool (`spawn_blocking`); synchronous
//! commands would otherwise execute on the main thread and freeze the window.

use crate::engine::{nlp, pdf_analyzer, search};
use crate::error::EngineError;
use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};

#[derive(Debug, Clone, Serialize)]
pub struct EngineInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub rayon_threads: usize,
    pub compiled_features: Vec<&'static str>,
}

async fn run_blocking<T, F>(task: F) -> Result<T, EngineError>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|err| EngineError::Task(err.to_string()))
}

#[tauri::command]
pub fn native_get_engine_info() -> EngineInfo {
    EngineInfo {
        name: "PDF Studio Native Engine (Rust)",
        version: env!("CARGO_PKG_VERSION"),
        rayon_threads: rayon::current_num_threads(),
        compiled_features: vec![
            "rayon_parallel_search",
            "nlp_statistics",
            "pdf_byte_inspector",
            "sha256",
        ],
    }
}

#[tauri::command]
pub async fn native_parallel_search(
    pages: Vec<search::PageInput>,
    options: search::SearchOptions,
) -> Result<search::SearchResult, EngineError> {
    run_blocking(move || search::execute_parallel_search(&pages, &options)).await?
}

#[tauri::command]
pub async fn native_analyze_nlp(
    pages: Vec<nlp::PageText>,
) -> Result<nlp::NlpAnalysisResult, EngineError> {
    run_blocking(move || nlp::analyze_document_nlp(&pages)).await
}

/// Expects the PDF as a raw binary request body (`invoke(cmd, uint8Array)`).
/// Sending bytes as a JSON number array would inflate a 100 MB file to roughly 400 MB of JSON.
#[tauri::command]
pub async fn native_analyze_pdf_structure(
    request: Request<'_>,
) -> Result<pdf_analyzer::PdfBinaryStructure, EngineError> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(EngineError::ExpectedBinaryBody);
    };
    let bytes = bytes.clone();
    run_blocking(move || pdf_analyzer::analyze_pdf_binary(&bytes)).await
}

//! Byte-level PDF inspection without a full parser.
//!
//! Counts are taken from uncompressed object dictionaries. Objects inside compressed
//! object streams (`/ObjStm`, PDF 1.5+) are invisible to a byte scan; `has_object_streams`
//! tells the UI that the counts are lower bounds in that case.

use regex::bytes::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfBinaryStructure {
    pub file_size_bytes: usize,
    pub sha256_hash: String,
    /// Version from the `%PDF-x.y` header, `None` if no header was found.
    pub pdf_version: Option<String>,
    pub page_objects_count: usize,
    pub font_objects_count: usize,
    pub annotation_objects_count: usize,
    pub has_object_streams: bool,
    pub is_encrypted: bool,
    pub has_embedded_files: bool,
    pub analysis_time_ms: u128,
}

struct Patterns {
    header: Regex,
    page: Regex,
    font: Regex,
    annotation: Regex,
    object_stream: Regex,
    encrypt: Regex,
    embedded_files: Regex,
}

fn patterns() -> &'static Patterns {
    static PATTERNS: OnceLock<Patterns> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        let re = |p: &str| Regex::new(p).expect("static pattern");
        Patterns {
            header: re(r"%PDF-(\d\.\d)"),
            // `\b` stops "/Type /Page" from also matching the page tree node "/Type /Pages".
            page: re(r"(?-u)/Type\s*/Page\b"),
            font: re(r"(?-u)/Type\s*/Font\b"),
            annotation: re(r"(?-u)/Subtype\s*/(?:Text|Link|FreeText|Line|Square|Circle|Polygon|PolyLine|Highlight|Underline|Squiggly|StrikeOut|Stamp|Caret|Ink|Popup|FileAttachment|Sound|Movie|Widget|Screen|PrinterMark|TrapNet|Watermark|3D|Redact)\b"),
            object_stream: re(r"(?-u)/Type\s*/ObjStm\b"),
            encrypt: re(r"(?-u)/Encrypt\b"),
            embedded_files: re(r"(?-u)/EmbeddedFiles\b"),
        }
    })
}

/// The header may be preceded by up to 1024 bytes of junk (PDF 32000-1, 7.5.2).
const HEADER_WINDOW: usize = 1024;

pub fn analyze_pdf_binary(bytes: &[u8]) -> PdfBinaryStructure {
    let start_time = std::time::Instant::now();
    let p = patterns();

    let sha256_hash = format!("{:x}", Sha256::digest(bytes));
    let pdf_version = p
        .header
        .captures(&bytes[..bytes.len().min(HEADER_WINDOW)])
        .and_then(|c| c.get(1))
        .map(|m| String::from_utf8_lossy(m.as_bytes()).into_owned());

    PdfBinaryStructure {
        file_size_bytes: bytes.len(),
        sha256_hash,
        pdf_version,
        page_objects_count: p.page.find_iter(bytes).count(),
        font_objects_count: p.font.find_iter(bytes).count(),
        annotation_objects_count: p.annotation.find_iter(bytes).count(),
        has_object_streams: p.object_stream.is_match(bytes),
        is_encrypted: p.encrypt.is_match(bytes),
        has_embedded_files: p.embedded_files.is_match(bytes),
        analysis_time_ms: start_time.elapsed().as_millis(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &[u8] = b"%PDF-1.7\n1 0 obj\n<< /Type /Pages /Kids [2 0 R] >>\nendobj\n2 0 obj\n<< /Type/Page /Annots [4 0 R] >>\nendobj\n3 0 obj\n<< /Type /Font >>\nendobj\n4 0 obj\n<< /Type /Annot /Subtype /Link >>\nendobj\ntrailer\n<< /Size 5 >>\n%%EOF";

    #[test]
    fn counts_objects_without_confusing_pages_and_page_tree() {
        let result = analyze_pdf_binary(SAMPLE);
        assert_eq!(result.pdf_version.as_deref(), Some("1.7"));
        assert_eq!(result.page_objects_count, 1);
        assert_eq!(result.font_objects_count, 1);
        assert_eq!(result.annotation_objects_count, 1);
        assert!(!result.is_encrypted);
        assert!(!result.has_object_streams);
        assert!(!result.has_embedded_files);
    }

    #[test]
    fn computes_real_sha256() {
        let result = analyze_pdf_binary(b"abc");
        assert_eq!(
            result.sha256_hash,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(result.pdf_version, None);
    }

    #[test]
    fn detects_encryption_and_object_streams() {
        let result =
            analyze_pdf_binary(b"%PDF-1.5\n<< /Type /ObjStm >>\ntrailer << /Encrypt 9 0 R >>");
        assert!(result.is_encrypted);
        assert!(result.has_object_streams);
    }

    #[test]
    fn handles_non_utf8_binary_content() {
        let mut bytes = b"%PDF-1.4\n".to_vec();
        bytes.extend_from_slice(&[0xff, 0xfe, 0x00, 0xc3]);
        bytes.extend_from_slice(b"<< /Type /Page >>");
        assert_eq!(analyze_pdf_binary(&bytes).page_objects_count, 1);
    }
}

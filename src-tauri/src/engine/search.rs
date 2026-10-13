use crate::error::EngineError;
use rayon::prelude::*;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

/// Upper bound for the compiled regex program; protects against pathological user patterns.
const REGEX_SIZE_LIMIT: usize = 1 << 20;
const DEFAULT_SNIPPET_PADDING: usize = 40;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SearchMatch {
    pub page_number: usize,
    pub match_index: usize,
    /// Offset of the match in UTF-16 code units, i.e. directly usable as a JavaScript string index.
    pub char_offset: usize,
    /// Length of the match in UTF-16 code units.
    pub match_length: usize,
    pub snippet: String,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageInput {
    pub page_number: usize,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchOptions {
    pub query: String,
    pub case_sensitive: bool,
    pub is_regex: bool,
    /// 0 = unlimited.
    pub max_results_per_page: usize,
    /// Context characters (not bytes) on each side of a match. 0 = default.
    pub snippet_padding: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub total_matches: usize,
    pub duration_ms: u128,
    pub matches: Vec<SearchMatch>,
}

pub fn build_regex(options: &SearchOptions) -> Result<Regex, EngineError> {
    let pattern = if options.is_regex {
        options.query.clone()
    } else {
        regex::escape(&options.query)
    };
    RegexBuilder::new(&pattern)
        .case_insensitive(!options.case_sensitive)
        .size_limit(REGEX_SIZE_LIMIT)
        .build()
        .map_err(|err| EngineError::InvalidPattern(err.to_string()))
}

/// Searches all pages in parallel (one rayon task per page).
///
/// Results are ranked by a simple term-frequency score (matches per 100 characters,
/// slightly favouring earlier pages); ties keep document order.
pub fn execute_parallel_search(
    pages: &[PageInput],
    options: &SearchOptions,
) -> Result<SearchResult, EngineError> {
    let start_time = std::time::Instant::now();

    if options.query.trim().is_empty() || pages.is_empty() {
        return Ok(SearchResult {
            total_matches: 0,
            duration_ms: start_time.elapsed().as_millis(),
            matches: Vec::new(),
        });
    }

    let regex = build_regex(options)?;
    let padding = if options.snippet_padding == 0 {
        DEFAULT_SNIPPET_PADDING
    } else {
        options.snippet_padding
    };
    let total_pages = pages.len();

    let mut matches: Vec<SearchMatch> = pages
        .par_iter()
        .flat_map_iter(|page| {
            search_page(
                &regex,
                page,
                options.max_results_per_page,
                padding,
                total_pages,
            )
        })
        .collect();

    matches.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(Ordering::Equal)
            .then_with(|| a.page_number.cmp(&b.page_number))
            .then_with(|| a.char_offset.cmp(&b.char_offset))
    });

    Ok(SearchResult {
        total_matches: matches.len(),
        duration_ms: start_time.elapsed().as_millis(),
        matches,
    })
}

fn search_page(
    regex: &Regex,
    page: &PageInput,
    max_results: usize,
    padding: usize,
    total_pages: usize,
) -> Vec<SearchMatch> {
    let text = page.text.as_str();
    // Empty matches (e.g. the pattern `a*`) carry no information and would flood the result.
    let found: Vec<(usize, usize)> = regex
        .find_iter(text)
        .filter(|m| !m.is_empty())
        .map(|m| (m.start(), m.end()))
        .collect();
    if found.is_empty() {
        return Vec::new();
    }

    // Score is a property of the page, computed once instead of once per match.
    let page_chars = text.chars().count().max(1) as f32;
    let term_frequency = found.len() as f32 / (page_chars / 100.0).max(1.0);
    let page_weight = 1.0 / (page.page_number as f32 / total_pages as f32 + 1.0);
    let score = term_frequency * page_weight;

    let limit = if max_results == 0 {
        found.len()
    } else {
        max_results.min(found.len())
    };
    let mut utf16_cursor = Utf16Cursor::default();

    found
        .into_iter()
        .take(limit)
        .enumerate()
        .map(|(idx, (start, end))| {
            let char_offset = utf16_cursor.advance_to(text, start);
            let match_length = text[start..end].encode_utf16().count();
            SearchMatch {
                page_number: page.page_number,
                match_index: idx + 1,
                char_offset,
                match_length,
                snippet: build_snippet(text, start, end, padding),
                score,
            }
        })
        .collect()
}

/// Converts increasing byte offsets into UTF-16 offsets in amortized O(n) per page.
#[derive(Default)]
struct Utf16Cursor {
    byte: usize,
    utf16: usize,
}

impl Utf16Cursor {
    fn advance_to(&mut self, text: &str, byte_offset: usize) -> usize {
        self.utf16 += text[self.byte..byte_offset].encode_utf16().count();
        self.byte = byte_offset;
        self.utf16
    }
}

/// Builds `...context match context...` with `padding` characters on each side.
/// Works on char boundaries, so multi-byte characters (ä, ß, emoji) can never cause a panic.
pub fn build_snippet(text: &str, start: usize, end: usize, padding: usize) -> String {
    let snippet_start = text[..start]
        .char_indices()
        .rev()
        .nth(padding.saturating_sub(1))
        .map(|(i, _)| i)
        .unwrap_or(0);
    let snippet_end = text[end..]
        .char_indices()
        .nth(padding)
        .map(|(i, _)| end + i)
        .unwrap_or(text.len());

    let prefix = if snippet_start > 0 { "..." } else { "" };
    let suffix = if snippet_end < text.len() { "..." } else { "" };
    let body: String = text[snippet_start..snippet_end]
        .chars()
        .map(|c| if c == '\n' || c == '\r' { ' ' } else { c })
        .collect();
    format!("{prefix}{body}{suffix}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options(query: &str) -> SearchOptions {
        SearchOptions {
            query: query.to_string(),
            case_sensitive: false,
            is_regex: false,
            max_results_per_page: 0,
            snippet_padding: 10,
        }
    }

    fn page(page_number: usize, text: &str) -> PageInput {
        PageInput {
            page_number,
            text: text.to_string(),
        }
    }

    #[test]
    fn finds_plain_matches_case_insensitive() {
        let pages = vec![
            page(1, "PDF Studio is a privacy-first pdf editor."),
            page(2, "Built with React, TypeScript, and Rust."),
        ];
        let result = execute_parallel_search(&pages, &options("PDF")).unwrap();
        assert_eq!(result.total_matches, 2);
        assert!(result.matches.iter().all(|m| m.page_number == 1));
    }

    #[test]
    fn respects_case_sensitivity() {
        let pages = vec![page(1, "PDF pdf Pdf")];
        let mut opts = options("PDF");
        opts.case_sensitive = true;
        assert_eq!(
            execute_parallel_search(&pages, &opts)
                .unwrap()
                .total_matches,
            1
        );
    }

    #[test]
    fn supports_regex_patterns() {
        let pages = vec![page(1, "Contact info@example.com or support@pdfstudio.io")];
        let mut opts = options(r"[\w.-]+@[\w.-]+\.\w+");
        opts.is_regex = true;
        assert_eq!(
            execute_parallel_search(&pages, &opts)
                .unwrap()
                .total_matches,
            2
        );
    }

    #[test]
    fn escapes_regex_metacharacters_in_plain_mode() {
        let pages = vec![page(1, "Kosten (netto): 5.00 EUR, 5x00 EUR")];
        let result = execute_parallel_search(&pages, &options("5.00")).unwrap();
        assert_eq!(result.total_matches, 1);
    }

    #[test]
    fn rejects_invalid_regex_with_typed_error() {
        let pages = vec![page(1, "text")];
        let mut opts = options("(unclosed");
        opts.is_regex = true;
        let err = execute_parallel_search(&pages, &opts).unwrap_err();
        assert_eq!(err.code(), "invalid-pattern");
    }

    #[test]
    fn does_not_panic_on_multibyte_characters_at_snippet_edges() {
        // Every character around the match is multi-byte; byte-based slicing used to panic here.
        let text = "äöüßäöüßäöüß Frist äöüßäöüßäöüß 🙂🙂🙂";
        for padding in 0..20 {
            let mut opts = options("Frist");
            opts.snippet_padding = padding;
            let result = execute_parallel_search(&[page(1, text)], &opts).unwrap();
            assert_eq!(result.total_matches, 1);
            assert!(result.matches[0].snippet.contains("Frist"));
        }
    }

    #[test]
    fn reports_utf16_offsets_for_javascript() {
        // "🙂" is 4 bytes in UTF-8 but 2 code units in UTF-16; "ä" is 2 bytes but 1 code unit.
        let text = "🙂ä Treffer und Treffer";
        let result = execute_parallel_search(&[page(1, text)], &options("Treffer")).unwrap();
        let mut offsets: Vec<usize> = result.matches.iter().map(|m| m.char_offset).collect();
        offsets.sort_unstable();
        assert_eq!(offsets, vec![4, 16]);
        assert!(result.matches.iter().all(|m| m.match_length == 7));
    }

    #[test]
    fn limits_results_per_page() {
        let mut opts = options("a");
        opts.max_results_per_page = 2;
        let result = execute_parallel_search(&[page(1, "a a a a a")], &opts).unwrap();
        assert_eq!(result.total_matches, 2);
    }

    #[test]
    fn ignores_empty_matches() {
        let mut opts = options("x*");
        opts.is_regex = true;
        let result = execute_parallel_search(&[page(1, "abc")], &opts).unwrap();
        assert_eq!(result.total_matches, 0);
    }

    #[test]
    fn empty_query_returns_no_matches() {
        let result = execute_parallel_search(&[page(1, "abc")], &options("   ")).unwrap();
        assert_eq!(result.total_matches, 0);
    }

    #[test]
    fn snippet_uses_character_padding_and_ellipsis() {
        let text = "0123456789 match 0123456789";
        let start = text.find("match").unwrap();
        let snippet = build_snippet(text, start, start + 5, 3);
        assert_eq!(snippet, "...89 match 01...");
    }
}

//! Lightweight, dependency-free text statistics.
//!
//! The same algorithm is implemented in `src/services/analysis/nlp.ts` for the browser build;
//! both are covered by tests that use identical fixtures, so results stay comparable.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use unicode_segmentation::UnicodeSegmentation;

const MIN_SENTENCE_CHARS: usize = 10;
const MAX_KEY_PHRASES: usize = 10;
const MAX_TOP_SENTENCES: usize = 5;
const MAX_ACTION_ITEMS: usize = 8;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    De,
    En,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadabilityMetrics {
    pub language: Language,
    pub total_words: usize,
    pub total_sentences: usize,
    pub total_syllables: usize,
    /// Flesch Reading Ease (English) or the Amstad adaptation (German), clamped to 0..100.
    pub flesch_reading_ease: f32,
    /// US grade level; only defined for English text.
    pub flesch_kincaid_grade: Option<f32>,
    pub avg_words_per_sentence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyPhrase {
    pub phrase: String,
    pub frequency: usize,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedSentence {
    pub page_number: usize,
    pub sentence: String,
    pub score: f32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    High,
    Medium,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionItem {
    pub page_number: usize,
    pub text: String,
    pub priority: Priority,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NlpAnalysisResult {
    pub readability: ReadabilityMetrics,
    pub key_phrases: Vec<KeyPhrase>,
    pub top_sentences: Vec<RankedSentence>,
    pub action_items: Vec<ActionItem>,
    pub execution_time_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageText {
    pub page_number: usize,
    pub text: String,
}

const STOPWORDS_EN: &[&str] = &[
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on",
    "with", "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say",
    "her", "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so",
    "up", "out", "if", "about", "who", "get", "which", "go", "me", "is", "are", "was", "were",
    "been", "has", "had", "can", "could", "should", "must", "shall", "may", "these", "those",
    "than", "then", "also", "into", "its", "our", "your", "any", "each", "such",
];

const STOPWORDS_DE: &[&str] = &[
    "der", "die", "das", "und", "in", "zu", "den", "ist", "nicht", "von", "sie", "mit", "dem",
    "sich", "des", "auf", "für", "ein", "eine", "einer", "eines", "einem", "einen", "als", "auch",
    "es", "an", "werden", "wird", "aus", "er", "hat", "dass", "sind", "noch", "wie", "bei", "um",
    "am", "im", "nach", "oder", "nur", "vor", "zur", "zum", "bis", "mehr", "durch", "kann",
    "können", "muss", "müssen", "soll", "sollen", "sollte", "wir", "ich", "ihr", "ihre", "ihren",
    "dieser", "diese", "dieses", "über", "unter", "so", "wenn", "aber", "was", "wer", "hier", "da",
    "sein", "seine", "war", "wurde", "wurden", "haben", "bitte",
];

/// Words that are noise in every document of this application.
const DOMAIN_STOPWORDS: &[&str] = &["pdf", "page", "seite"];

const ACTION_KEYWORDS_HIGH: &[&str] = &[
    "must",
    "todo",
    "verify",
    "deadline",
    "muss",
    "müssen",
    "frist",
    "spätestens",
    "unbedingt",
    "zwingend",
];
const ACTION_KEYWORDS_MEDIUM: &[&str] = &[
    "should",
    "shall",
    "action",
    "implement",
    "review",
    "ensure",
    "complete",
    "soll",
    "sollen",
    "sollte",
    "bitte",
    "prüfen",
    "überprüfen",
    "erledigen",
    "einreichen",
    "zahlen",
    "unterschreiben",
];

/// Picks German or English by counting stopword hits; ties default to English.
pub fn detect_language(words: &[String]) -> Language {
    let de: HashSet<&str> = STOPWORDS_DE.iter().copied().collect();
    let en: HashSet<&str> = STOPWORDS_EN.iter().copied().collect();
    let (mut de_hits, mut en_hits) = (0usize, 0usize);
    for word in words {
        if de.contains(word.as_str()) {
            de_hits += 1;
        }
        if en.contains(word.as_str()) {
            en_hits += 1;
        }
    }
    if de_hits > en_hits {
        Language::De
    } else {
        Language::En
    }
}

/// Counts vowel groups; diphthongs (ei, au, eu, äu, ie) and umlauts are handled because
/// consecutive vowels form a single group. A silent trailing English "e" is dropped.
pub fn count_syllables(word: &str, language: Language) -> usize {
    let lower = word.to_lowercase();
    if lower.chars().count() <= 3 {
        return 1;
    }
    let is_vowel = |c: char| matches!(c, 'a' | 'e' | 'i' | 'o' | 'u' | 'y' | 'ä' | 'ö' | 'ü');
    let mut count = 0;
    let mut prev_vowel = false;
    for c in lower.chars() {
        let vowel = is_vowel(c);
        if vowel && !prev_vowel {
            count += 1;
        }
        prev_vowel = vowel;
    }
    if language == Language::En && lower.ends_with('e') && !lower.ends_with("le") && count > 1 {
        count -= 1;
    }
    count.max(1)
}

fn is_word(token: &str) -> bool {
    token.chars().count() > 1
        && token.chars().all(|c| c.is_alphanumeric())
        && token.chars().any(|c| c.is_alphabetic())
}

pub fn analyze_document_nlp(pages: &[PageText]) -> NlpAnalysisResult {
    let start_time = std::time::Instant::now();

    let mut words: Vec<String> = Vec::new();
    let mut sentences: Vec<(usize, String)> = Vec::new();

    for page in pages {
        for sentence in page.text.unicode_sentences() {
            let trimmed = sentence.split_whitespace().collect::<Vec<_>>().join(" ");
            if trimmed.chars().count() > MIN_SENTENCE_CHARS {
                sentences.push((page.page_number, trimmed));
            }
        }
        words.extend(
            page.text
                .unicode_words()
                .map(str::to_lowercase)
                .filter(|w| is_word(w)),
        );
    }

    let language = detect_language(&words);
    let readability = readability(&words, sentences.len(), language);

    let stopwords: HashSet<&str> = STOPWORDS_EN
        .iter()
        .chain(STOPWORDS_DE)
        .chain(DOMAIN_STOPWORDS)
        .copied()
        .collect();

    let mut frequency: HashMap<&str, usize> = HashMap::new();
    for word in &words {
        if word.chars().count() > 2
            && !stopwords.contains(word.as_str())
            && !word.chars().all(|c| c.is_numeric())
        {
            *frequency.entry(word.as_str()).or_insert(0) += 1;
        }
    }

    let mut key_phrases: Vec<KeyPhrase> = frequency
        .into_iter()
        .map(|(phrase, frequency)| KeyPhrase {
            phrase: phrase.to_string(),
            frequency,
            score: frequency as f32 * (phrase.chars().count() as f32).sqrt(),
        })
        .collect();
    key_phrases.sort_by(|a, b| {
        b.score
            .total_cmp(&a.score)
            .then_with(|| a.phrase.cmp(&b.phrase))
    });
    key_phrases.truncate(MAX_KEY_PHRASES);

    let phrase_scores: HashMap<&str, f32> = key_phrases
        .iter()
        .map(|kp| (kp.phrase.as_str(), kp.score))
        .collect();
    let mut top_sentences: Vec<RankedSentence> = sentences
        .iter()
        .map(|(page_number, sentence)| {
            let content: Vec<String> = sentence
                .unicode_words()
                .map(str::to_lowercase)
                .filter(|w| !stopwords.contains(w.as_str()))
                .collect();
            let score = if content.is_empty() {
                0.0
            } else {
                let sum: f32 = content
                    .iter()
                    .filter_map(|w| phrase_scores.get(w.as_str()))
                    .sum();
                sum / (content.len() as f32).sqrt()
            };
            RankedSentence {
                page_number: *page_number,
                sentence: sentence.clone(),
                score,
            }
        })
        .filter(|s| s.score > 0.0)
        .collect();
    top_sentences.sort_by(|a, b| {
        b.score
            .total_cmp(&a.score)
            .then_with(|| a.page_number.cmp(&b.page_number))
    });
    top_sentences.truncate(MAX_TOP_SENTENCES);

    let action_items = sentences
        .iter()
        .filter_map(|(page_number, sentence)| {
            classify_action(sentence).map(|priority| ActionItem {
                page_number: *page_number,
                text: sentence.clone(),
                priority,
            })
        })
        .take(MAX_ACTION_ITEMS)
        .collect();

    NlpAnalysisResult {
        readability,
        key_phrases,
        top_sentences,
        action_items,
        execution_time_ms: start_time.elapsed().as_millis(),
    }
}

fn contains_word(words: &[String], keywords: &[&str]) -> bool {
    words.iter().any(|w| keywords.contains(&w.as_str()))
}

pub fn classify_action(sentence: &str) -> Option<Priority> {
    let words: Vec<String> = sentence.unicode_words().map(str::to_lowercase).collect();
    if contains_word(&words, ACTION_KEYWORDS_HIGH) {
        Some(Priority::High)
    } else if contains_word(&words, ACTION_KEYWORDS_MEDIUM) {
        Some(Priority::Medium)
    } else {
        None
    }
}

fn readability(words: &[String], sentence_count: usize, language: Language) -> ReadabilityMetrics {
    let total_words = words.len();
    let total_syllables: usize = words.iter().map(|w| count_syllables(w, language)).sum();
    if total_words == 0 || sentence_count == 0 {
        return ReadabilityMetrics {
            language,
            total_words,
            total_sentences: sentence_count,
            total_syllables,
            flesch_reading_ease: 0.0,
            flesch_kincaid_grade: None,
            avg_words_per_sentence: 0.0,
        };
    }

    let asl = total_words as f32 / sentence_count as f32;
    let asw = total_syllables as f32 / total_words as f32;
    let (ease, grade) = match language {
        // Amstad (1978): German adaptation of the Flesch formula.
        Language::De => (180.0 - asl - 58.5 * asw, None),
        Language::En => (
            206.835 - 1.015 * asl - 84.6 * asw,
            Some((0.39 * asl + 11.8 * asw - 15.59).max(0.0)),
        ),
    };

    ReadabilityMetrics {
        language,
        total_words,
        total_sentences: sentence_count,
        total_syllables,
        flesch_reading_ease: ease.clamp(0.0, 100.0),
        flesch_kincaid_grade: grade,
        avg_words_per_sentence: asl,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pages(texts: &[&str]) -> Vec<PageText> {
        texts
            .iter()
            .enumerate()
            .map(|(i, t)| PageText {
                page_number: i + 1,
                text: t.to_string(),
            })
            .collect()
    }

    #[test]
    fn counts_syllables_for_english_and_german() {
        assert_eq!(count_syllables("test", Language::En), 1);
        assert_eq!(count_syllables("performance", Language::En), 3);
        assert_eq!(count_syllables("architecture", Language::En), 4);
        assert_eq!(count_syllables("Häuser", Language::De), 2);
        assert_eq!(count_syllables("Kündigungsfrist", Language::De), 4);
    }

    #[test]
    fn detects_language_from_stopwords() {
        let de = analyze_document_nlp(&pages(&["Der Vertrag ist bis zum Ende des Monats zu kündigen und die Frist muss eingehalten werden."]));
        assert_eq!(de.readability.language, Language::De);
        assert!(de.readability.flesch_kincaid_grade.is_none());

        let en = analyze_document_nlp(&pages(&[
            "The contract must be cancelled by the end of the month and the deadline is strict.",
        ]));
        assert_eq!(en.readability.language, Language::En);
        assert!(en.readability.flesch_kincaid_grade.is_some());
    }

    #[test]
    fn extracts_action_items_with_priorities() {
        let result = analyze_document_nlp(&pages(&[
            "PDF Studio must ensure high performance and zero telemetry.",
            "The engineering team should review the architecture soon.",
            "This sentence is only informational content.",
        ]));
        let priorities: Vec<(usize, Priority)> = result
            .action_items
            .iter()
            .map(|a| (a.page_number, a.priority))
            .collect();
        assert_eq!(priorities, vec![(1, Priority::High), (2, Priority::Medium)]);
    }

    #[test]
    fn key_phrases_skip_stopwords_and_rank_by_frequency() {
        let result = analyze_document_nlp(&pages(&[
            "Rechnung Rechnung Rechnung Betrag Betrag und und und und der der der.",
        ]));
        let phrases: Vec<&str> = result
            .key_phrases
            .iter()
            .map(|k| k.phrase.as_str())
            .collect();
        assert_eq!(phrases, vec!["rechnung", "betrag"]);
        assert_eq!(result.key_phrases[0].frequency, 3);
    }

    #[test]
    fn empty_input_yields_zero_metrics_instead_of_fake_values() {
        let result = analyze_document_nlp(&pages(&["", "   "]));
        assert_eq!(result.readability.total_words, 0);
        assert_eq!(result.readability.total_sentences, 0);
        assert_eq!(result.readability.flesch_reading_ease, 0.0);
        assert!(result.key_phrases.is_empty());
        assert!(result.top_sentences.is_empty());
    }

    #[test]
    fn readability_matches_reference_formula() {
        // 2 sentences, 12 words → ASL 6; syllables computed with the same counter.
        let text = "The cat sat on the mat. The dog ran to the park.";
        let result = analyze_document_nlp(&pages(&[text]));
        let r = &result.readability;
        assert_eq!(r.total_words, 12);
        assert_eq!(r.total_sentences, 2);
        let expected = 206.835 - 1.015 * 6.0 - 84.6 * (r.total_syllables as f32 / 12.0);
        assert!((r.flesch_reading_ease - expected.clamp(0.0, 100.0)).abs() < 1e-3);
    }
}

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

/// Errors returned by the native engine commands.
///
/// Serialized as `{ "code": "...", "message": "..." }` so the TypeScript bridge can
/// map them to typed errors instead of parsing strings.
#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("invalid search pattern: {0}")]
    InvalidPattern(String),
    #[error("the command expects a raw binary request body")]
    ExpectedBinaryBody,
    #[error("background task failed: {0}")]
    Task(String),
}

impl EngineError {
    pub fn code(&self) -> &'static str {
        match self {
            EngineError::InvalidPattern(_) => "invalid-pattern",
            EngineError::ExpectedBinaryBody => "expected-binary-body",
            EngineError::Task(_) => "task-failed",
        }
    }
}

impl Serialize for EngineError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("EngineError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_code_and_message() {
        let json =
            serde_json::to_value(EngineError::InvalidPattern("unclosed group".into())).unwrap();
        assert_eq!(json["code"], "invalid-pattern");
        assert_eq!(json["message"], "invalid search pattern: unclosed group");
    }
}

from pydantic import BaseModel, Field


class PhonemeError(BaseModel):
    position: int
    expected: str
    actual: str
    tip: str | None = None


class WordAssessment(BaseModel):
    word: str
    expected_phonemes: list[str]
    actual_phonemes: list[str]
    score: int = Field(ge=0, le=100)
    errors: list[PhonemeError]


class AssessmentResponse(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    words: list[WordAssessment]
    fluency_score: int = Field(ge=0, le=100)
    duration_seconds: float
    processing_time_ms: int


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    uptime_seconds: int


class PhonemesRequest(BaseModel):
    text: str
    language: str = 'en-us'


class WordPhonemes(BaseModel):
    word: str
    phonemes: list[str]


class PhonemesResponse(BaseModel):
    ipa: str
    words: list[WordPhonemes]

alter table recordings
add column if not exists pronunciation_assessment jsonb;

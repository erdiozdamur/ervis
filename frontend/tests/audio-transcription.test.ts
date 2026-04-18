import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOpenAiAudioTranscriptionPayload } from '@/services/meal-analysis/audio-transcription-service';

test('audio transcription payload parsing normalizes transcript text', () => {
  const result = parseOpenAiAudioTranscriptionPayload({
    text: '  bir tabak mercimek   corbasi \n ve 1 bardak ayran  ',
    language: 'tr',
    duration: 8.42,
  });

  assert.equal(result.transcriptText, 'bir tabak mercimek corbasi ve 1 bardak ayran');
  assert.equal(result.language, 'tr');
  assert.equal(result.durationSeconds, 8.42);
});

test('audio transcription payload parsing rejects missing transcript text', () => {
  assert.throws(() => parseOpenAiAudioTranscriptionPayload({ text: '   ' }), {
    message: 'The transcription response did not include usable transcript text.',
  });
});

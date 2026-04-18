import assert from 'node:assert/strict';
import test from 'node:test';
import { createMealDraftFromIntake } from '@/services/meals/meal-intake-service';

test('createMealDraftFromIntake rejects empty intake gracefully', async () => {
  const result = await createMealDraftFromIntake('user_1', new FormData());

  assert.equal(result.ok, false);
  assert.equal(result.ok === false ? result.message : null, 'Add a description, a photo, or an audio note to start the meal draft.');
});

test('createMealDraftFromIntake rejects unsupported image uploads before persistence starts', async () => {
  const formData = new FormData();
  formData.append('imageUploads', new File(['not an image'], 'notes.txt', { type: 'text/plain' }));

  const result = await createMealDraftFromIntake('user_1', formData);

  assert.equal(result.ok, false);
  assert.equal(result.ok === false ? result.fieldErrors?.images : null, 'Only image files are allowed for photo and camera inputs.');
});

test('createMealDraftFromIntake enforces the per-draft image limit', async () => {
  const formData = new FormData();

  for (let index = 0; index < 7; index += 1) {
    formData.append('imageUploads', new File([`image-${index}`], `meal-${index}.jpg`, { type: 'image/jpeg' }));
  }

  const result = await createMealDraftFromIntake('user_1', formData);

  assert.equal(result.ok, false);
  assert.equal(result.ok === false ? result.fieldErrors?.images : null, 'Keep the draft to 6 images or fewer.');
});

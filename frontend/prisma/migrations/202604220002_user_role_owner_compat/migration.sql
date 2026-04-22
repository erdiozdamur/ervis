DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole'
      AND e.enumlabel = 'OWNER'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'OWNER';
  END IF;
END $$;

-- Home feed listens to INSERT/UPDATE/DELETE on public.lives.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lives'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lives;
  END IF;
END $$;


REVOKE ALL PRIVILEGES ON TABLE
  public.profiles,
  public.matches,
  public.moves,
  public.matchmaking_queue,
  public.chat_messages
FROM anon, authenticated;

GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT SELECT ON TABLE public.matches, public.moves TO authenticated;

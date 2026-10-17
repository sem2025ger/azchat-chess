export default function RouteLoadingFallback() {
  return (
    <div aria-busy="true" className="flex-1 min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-chess-active/20 border-t-chess-active animate-spin motion-reduce:animate-none" />
    </div>
  );
}

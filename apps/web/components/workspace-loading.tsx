export function WorkspaceLoading() {
  return <div role="status" aria-label="Loading class workspace"><div className="workspace-skeleton" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index}/>)}</div></div>;
}

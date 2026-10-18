'use client';
export function WorkspaceTabs({ tabs, selected, onSelect }: { tabs: readonly string[]; selected: string; onSelect: (tab: string) => void }) {
  return <div className="workspace-tabs" role="tablist" aria-label="Class workspace">{tabs.map((tab, index) => <button type="button" key={tab} id={`workspace-tab-${index}`} role="tab" aria-selected={selected === tab} aria-controls="workspace-panel" tabIndex={selected === tab ? 0 : -1} className={selected === tab ? 'active' : ''} onClick={() => onSelect(tab)} onKeyDown={event => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); onSelect(tabs[next]);
    const button = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
    button?.focus(); button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }}>{tab}</button>)}</div>;
}

import { FolderOpen, HardDrive } from 'lucide-react';
import { desktop, desktopNotice } from './desktop.ts';

export function DesktopLibrary() {
  if (!desktop) return null;
  return <aside className="desktop-library" aria-label="Mac storage">
    <span className="desktop-library-icon"><HardDrive size={21}/></span>
    <div><strong>A little studio. Right at home.</strong><p>Your projects save automatically to this Mac. Yours to keep, even offline.</p></div>
    <button className="secondary-button" onClick={() => void desktop!.showLibrary().catch(() => desktopNotice('The project folder could not be opened. Try Xbieha → Show project folder in the menu.'))}><FolderOpen size={16}/> Show project folder</button>
  </aside>;
}

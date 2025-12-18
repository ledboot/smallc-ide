import type {FileType} from './types';

export const HOME_CONTENT = `
 ____   __  __     _     _      _      ____      ___  ____   _____ 
/ ___| |  \\/  |   / \\   | |    | |    / ___|    |_ _||  _ \\ | ____|
\\___ \\ | |\\/| |  / _ \\  | |    | |   | |         | | | | | ||  _|  
 ___) || |  | | / ___ \\ | |___ | |___| |___      | | | |_| || |___ 
|____/ |_|  |_|/_/   \\_\\|_____||_____|\\____|    |___||____/ |_____|

A powerful, web-based development environment for the SmallC language.

[ Keyboard Shortcuts ]
  Compile           : Ctrl + S
  Search            : Ctrl + Shift + F
  Format Code       : Ctrl + Alt + F

[ Important Links ]
  GitHub            : https://github.com/ledboot/smallc-ide
  Discord           : https://discord.gg/your-invitation
  Twitter           : https://x.com/your-handle

Welcome to SmallC IDE Web! Select a file from the explorer to start coding.
`;

export const HOME_TAB: FileType = {
  id: 'home',
  name: 'Home',
  content: HOME_CONTENT,
  lastModified: new Date().toISOString(),
  isDirectory: false,
};

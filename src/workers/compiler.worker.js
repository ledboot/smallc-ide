/* global importScripts */
self.Module = {
  onRuntimeInitialized: function () {
    postMessage({type: 'READY'});
  },
  print: function (text) {
    postMessage({type: 'STDOUT', data: text});
  },
  printErr: function (text) {
    postMessage({type: 'STDERR', data: text});
  },
  locateFile: function (path, prefix) {
    if (path.endsWith('.wasm')) {
      return `${self.location.origin}/${path}`;
    }
    return prefix + path;
  },
};

// Use absolute URL to ensure correct resolution in all worker environments
const origin = self.location.origin;
importScripts(`${origin}/smallc_wasm.js`);

self.onmessage = function (e) {
  const {type, payload} = e.data;

  if (type === 'COMPILE') {
    const {args, files} = payload;

    try {
      self.ls();

      // 2. Clean workspace (optional but recommended)
      // For now, we overwrite existing files.
      // Ideally, we could delete everything in /workspace first.
      self.cleanWorkspace();

      // 3. Write files
      files.forEach(file => {
        const path = `${file.name}`;
        console.log('Writing file:', path);
        self.Module.FS.writeFile(path, file.content);
      });

      // 4. Compile
      // console.log('Worker running:', args);
      const ret = self.Module.callMain(args);
      console.log('compile result', ret);

      // 5. Capture output files (.asm, .abi)
      // We assume the compiler generates files in /workspace
      // We'll scan the directory for new files or specific extensions
      const outputFiles = [];
      const allFiles = self.Module.FS.readdir('/');

      for (const filename of allFiles) {
        console.log('read file->', filename);
        if (filename.endsWith('.asm') || filename.endsWith('.abi')) {
          const content = self.Module.FS.readFile(filename, {
            encoding: 'utf8',
          });
          outputFiles.push({name: filename, content: content});
        }
      }
      // 6. 清理workspace
      self.cleanWorkspace();

      postMessage({
        type: 'COMPILE_DONE',
        result: {
          code: ret,
          outputFiles: outputFiles,
        },
      });
    } catch (err) {
      postMessage({
        type: 'COMPILE_ERROR',
        error: err.toString(),
      });
    }
  }
};

self.ls = function () {
  const files = self.Module.FS.readdir('/');
  for (const file of files) {
    console.log('ls->', file);
  }
};

self.cleanWorkspace = function () {
  self.rmrf('/');
};

self.rmrf = function (path) {
  try {
    const files = self.Module.FS.readdir(path);
    for (const file of files) {
      if (
        file === '.' ||
        file === '..' ||
        file === 'tmp' ||
        file === '/' ||
        file.includes('dev') ||
        file.includes('home') ||
        file.includes('proc')
      )
        continue;
      const fullPath = '/' + file;
      if (self.Module.FS.isDir(self.Module.FS.stat(fullPath).mode)) {
        console.log('rmrf Removing directory:', fullPath);
        self.rmrf(fullPath);
      } else {
        console.log('Removing file:', fullPath);
        self.Module.FS.unlink(fullPath);
      }
    }
    if (path === '/') {
      return;
    }
    console.log('Removing directory:', path);
    self.Module.FS.rmdir(path);
  } catch (e) {
    console.error('rmrf error:', path, e);
  }
};

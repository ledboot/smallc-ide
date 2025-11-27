self.Module = {
  onRuntimeInitialized: function () {
    postMessage({ type: "READY" });
  },
  print: function (text) {
    postMessage({ type: "STDOUT", data: text });
  },
  printErr: function (text) {
    postMessage({ type: "STDERR", data: text });
  },
  locateFile: function (path, prefix) {
    if (path.endsWith(".wasm")) {
      return `${self.location.origin}/${path}`;
    }
    return prefix + path;
  },
};

// Use absolute URL to ensure correct resolution in all worker environments
const origin = self.location.origin;
importScripts(`${origin}/smallc_wasm.js`);

self.onmessage = function (e) {
  const { type, payload } = e.data;

  if (type === "COMPILE") {
    const { args, files } = payload;

    try {
      // 1. Prepare environment
      if (!self.Module.FS.analyzePath("/workspace").exists) {
        self.Module.FS.mkdir("/workspace");
      }

      // 2. Clean workspace (optional but recommended)
      // For now, we overwrite existing files.
      // Ideally, we could delete everything in /workspace first.
      try {
        const existingFiles = self.Module.FS.readdir("/workspace");
        for (const file of existingFiles) {
          if (file !== "." && file !== "..") {
            try {
              self.Module.FS.unlink("/workspace/" + file);
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (e) {
        // ignore
      }

      // 3. Write files
      files.forEach((file) => {
        const path = `/workspace/${file.name}`;
        self.Module.FS.writeFile(path, file.content);
      });

      // 4. Compile
      // console.log('Worker running:', args);
      const ret = self.Module.callMain(args);

      // 5. Capture output files (.asm, .abi)
      // We assume the compiler generates files in /workspace
      // We'll scan the directory for new files or specific extensions
      const outputFiles = [];
      const allFiles = self.Module.FS.readdir("/workspace");

      for (const filename of allFiles) {
        if (filename.endsWith(".asm") || filename.endsWith(".abi")) {
          const content = self.Module.FS.readFile("/workspace/" + filename, {
            encoding: "utf8",
          });
          outputFiles.push({ name: filename, content: content });
        }
      }

      postMessage({
        type: "COMPILE_DONE",
        result: {
          code: ret,
          outputFiles: outputFiles,
        },
      });
    } catch (err) {
      postMessage({
        type: "COMPILE_ERROR",
        error: err.toString(),
      });
    }
  }
};

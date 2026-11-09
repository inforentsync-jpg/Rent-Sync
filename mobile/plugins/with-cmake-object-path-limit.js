// Expo config plugins are loaded as CommonJS by the CLI.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withAppBuildGradle } = require("expo/config-plugins");

const argument = '-DCMAKE_OBJECT_PATH_MAX=120';

module.exports = function withCmakeObjectPathLimit(config) {
  return withAppBuildGradle(config, (config) => {
    const { language, contents } = config.modResults;
    if (contents.includes(argument)) return config;
    if (language !== "groovy") {
      throw new Error("The CMake object-path limit plugin requires the Android Groovy build file.");
    }

    const defaultConfig = /^([ \t]*)defaultConfig\s*\{\s*$/m;
    const match = defaultConfig.exec(contents);
    if (!match) {
      throw new Error("Unable to add the CMake object-path limit to android.defaultConfig.");
    }

    const indent = `${match[1]}    `;
    const settings = [
      `${indent}externalNativeBuild {`,
      `${indent}    cmake {`,
      `${indent}        arguments "${argument}"`,
      `${indent}    }`,
      `${indent}}`,
      "",
    ].join("\n");
    const insertion = match.index + match[0].length;
    config.modResults.contents =
      contents.slice(0, insertion) + "\n" + settings + contents.slice(insertion);
    return config;
  });
};

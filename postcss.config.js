import postcssImport from 'postcss-import';
import postcssPresetEnv from 'postcss-preset-env';

export default {
  plugins: [
    postcssImport(), // <-- inlines @import files first
    postcssPresetEnv({
      stage: 2,
      features: {
        'custom-media-queries': true, // enables @custom-media
      },
    }),
  ],
};
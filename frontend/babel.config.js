module.exports = function (api) {
  const production = api.env('production');
  return {
    presets: ['babel-preset-expo'],
    // Remove all diagnostic calls before Hermes compilation; Axios errors can
    // otherwise include authorization headers and private response contents.
    plugins: production ? ['transform-remove-console'] : [],
  };
};

const base = require('./app.json');

module.exports = () => {
  const apiUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    let valid = false;
    try {
      const url = new URL(apiUrl);
      valid = url.protocol === 'https:' && !url.username && !url.password &&
        !url.search && !url.hash && (url.pathname === '/' || url.pathname === '') &&
        !['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname) &&
        !url.hostname.endsWith('.local') && !url.hostname.endsWith('.test') &&
        !url.hostname.endsWith('.example');
    } catch { /* The error below explains how to fix the build configuration. */ }
    if (!valid) throw new Error('Production builds require a public HTTPS server origin in EXPO_PUBLIC_BACKEND_URL (no path, credentials, query or fragment).');
  }
  const ios = process.env.EAS_BUILD_PROFILE === 'production' ? {
    ...base.expo.ios, infoPlist: { ...base.expo.ios.infoPlist,
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: false },
    },
  } : base.expo.ios;
  return { ...base.expo, ios, extra: { ...base.expo.extra, ...(apiUrl ? { apiUrl } : {}) } };
};

const base = require('./app.json');

function isPublicHttpsOrigin(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.search && !url.hash && (url.pathname === '/' || url.pathname === '') &&
      !['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname) &&
      !url.hostname.endsWith('.local') && !url.hostname.endsWith('.test') &&
      !url.hostname.endsWith('.example');
  } catch { return false; }
}

module.exports = () => {
  const apiUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  const authUrl = process.env.EXPO_PUBLIC_AUTH_URL?.trim();
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    if (!isPublicHttpsOrigin(apiUrl)) {
      throw new Error('Production builds require a public HTTPS server origin in EXPO_PUBLIC_BACKEND_URL (no path, credentials, query or fragment).');
    }
    if (authUrl && !isPublicHttpsOrigin(authUrl)) {
      throw new Error('Production builds require EXPO_PUBLIC_AUTH_URL to be a public HTTPS origin when overridden.');
    }
  }
  const ios = process.env.EAS_BUILD_PROFILE === 'production' ? {
    ...base.expo.ios, infoPlist: { ...base.expo.ios.infoPlist,
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: false },
    },
  } : base.expo.ios;
  return { ...base.expo, ios, extra: { ...base.expo.extra, ...(apiUrl ? { apiUrl } : {}) } };
};
